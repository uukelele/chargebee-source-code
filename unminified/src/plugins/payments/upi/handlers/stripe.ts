import {CbError} from '@/hosted_fields/common/errors';
import StripeRealTimeApmHandler from '@/plugins/payments/_stripe_real_time_apm/handler';
import LightBox from '@/extensions/three_domain_secure/common/lightbox';
import {PaymentAttempt, PaymentAttemptStatus} from '@/internal/payment-intent/types';
import {PaymentRedirectTimeouts} from '@/constants/enums';
import {retrievePaymentIntent} from './razorpay';
import UpiHandler from './index';
import Helpers from '@/helpers';

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_DURATION_MS = PaymentRedirectTimeouts.UPI;

/**
 * Stripe UPI handler.
 * After server-side confirmation via OpenPay:
 *
 * Desktop (default):
 *   1. Renders QR from action_payload.qr_code_image_url in our LightBox.
 *   2. Polls Stripe directly using client_secret — QR completion happens on an external
 *      device (customer's phone), so pollForAuthCompletion() (browser-store/return flow)
 *      is unreliable; we bypass it and poll Stripe's API directly instead.
 *   3. On terminal Stripe success, confirms Chargebee once to sync the PaymentIntent.
 *
 * Mobile (Helpers.isMobileOrTablet() === true):
 *   Stripe returns hosted_instructions_url — a device-aware Stripe-hosted page that
 *   shows a UPI app selector (GPay, PhonePe, etc.) and deep-links into the chosen app,
 *   same behaviour as Razorpay's intent flow on mobile (see RazorpayUpiHandler).
 *   We open it in a new tab so the checkout page (and its polling) stays alive, avoiding
 *   the full-page redirect that stripe.handleNextAction() would otherwise require.
 *
 * Timeout: 5 minutes (PaymentRedirectTimeouts.UPI), matching Stripe's UPI QR expiry.
 */
export default class StripeUpiHandler extends StripeRealTimeApmHandler {
  private readonly upiHandler: UpiHandler;
  private qrLightboxUpi: LightBox | null = null;
  private pollTimeoutId: ReturnType<typeof setTimeout> | null = null;
  // Holds the tab opened for the mobile hosted_instructions_url path so it can be
  // closed automatically once polling detects a terminal PI status.
  private mobileWindow: Window | null = null;
  redirectTimeout: number = PaymentRedirectTimeouts.UPI;

  constructor(handler: UpiHandler, ...args) {
    super(...args);
    this.upiHandler = handler;
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment() {
    // Sync paymentInfo so UpiHandler.initPayment() builds the full billing-aware payload.
    // PaymentIntentHandler.initiateAuthorization sets this.paymentInfo before calling initPayment().
    (this.upiHandler as any).paymentInfo = this.paymentInfo;
    return this.upiHandler.initPayment();
  }

  private openQr(qrCodeImageUrl: string): void {
    this.qrLightboxUpi = new LightBox('stripe-upi-qr');
    const iframe = this.qrLightboxUpi.createIframe('stripe-upi-qr-frame');
    this.qrLightboxUpi.show();
    iframe.style.cssText =
      'width:400px;height:420px;min-width:400px;min-height:420px;max-width:400px;max-height:420px;';
    iframe.onload = () => {
      const doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
      if (doc) {
        doc.open();
        doc.write(
          `<html><body style="display:flex;flex-direction:column;align-items:center;` +
            `justify-content:flex-start;box-sizing:border-box;padding:24px 16px;` +
            `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;gap:16px;">` +
            `<img src="${qrCodeImageUrl}" alt="UPI QR Code" style="max-width:240px;max-height:240px;"/>` +
            `<div style="font-size:14px;color:#555;text-align:center;">` +
            `Scan with your UPI app to complete payment.</div>` +
            `</body></html>`
        );
        doc.close();
      }
      this.qrLightboxUpi && this.qrLightboxUpi.hideLoader();
    };
    iframe.src = 'about:blank';
  }

  private closeQr(): void {
    if (this.pollTimeoutId) {
      clearTimeout(this.pollTimeoutId);
      this.pollTimeoutId = null;
    }
    // Close the mobile-path tab if it is still open (payment completed or failed).
    if (this.mobileWindow && !this.mobileWindow.closed) {
      this.mobileWindow.close();
      this.mobileWindow = null;
    }
    if (this.qrLightboxUpi) {
      this.qrLightboxUpi.close();
      this.qrLightboxUpi.destroy();
      this.qrLightboxUpi = null;
    }
  }

  private retrieveStripeIntent(clientSecret: string): Promise<{status: string | undefined; error?: any}> {
    if (clientSecret.indexOf('seti_') === 0) {
      return this.stripe.retrieveSetupIntent(clientSecret).then((result: any) => ({
        status: result.setupIntent && result.setupIntent.status,
        error: result.error,
      }));
    }
    return this.stripe.retrievePaymentIntent(clientSecret).then((result: any) => ({
      status: result.paymentIntent && result.paymentIntent.status,
      error: result.error,
    }));
  }

  private completeChargebeePayment(): Promise<any> {
    return this.confirmPayment().catch((err: any) => {
      const msg: string = (err && err.message) || '';
      // Two CB server errors indicate the PI was already authorized by a webhook before
      // this client-side confirm arrived (a race that is common in predev/prod where
      // the Stripe webhook is publicly reachable):
      //   - "Payment intent is authorized" — PaymentIntentErrorCodes explicit check
      //   - "Invalid Attempt status"       — OpenPayPaymentAttempt initiate3DS switch default
      //     when the active attempt is already AUTHORIZED (not INITED/REQUIRES_*).
      // In both cases we retrieve to verify authorization before treating as success.
      if (msg === 'Payment intent is authorized' || msg === 'Invalid Attempt status') {
        return retrievePaymentIntent(this.getPaymentIntent().id).then((data: any) => {
          this.setPaymentIntent(data.payment_intent);
          const attempt = this.getPaymentAttempt();
          if (attempt && attempt.status === PaymentAttemptStatus.AUTHORIZED) {
            return this.handlePaymentAttemptStatus(attempt.status);
          }
          throw err instanceof CbError ? err : new CbError(err);
        });
      }
      throw err instanceof CbError ? err : new CbError(err);
    });
  }

  private pollStripeUntilDone(clientSecret: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const poll = () => {
        if (Date.now() - startTime > MAX_POLL_DURATION_MS) {
          this.closeQr();
          return reject(new CbError({name: 'GATEWAY_ERROR', message: 'UPI payment timed out after 5 minutes'}));
        }

        this.retrieveStripeIntent(clientSecret)
          .then((result: any) => {
            if (result.error) {
              this.closeQr();
              return reject(new CbError({name: 'GATEWAY_ERROR', message: result.error.message}));
            }

            if (result.status === 'succeeded' || result.status === 'requires_capture') {
              return this.completeChargebeePayment().then(
                (data: any) => {
                  this.closeQr();
                  resolve(data);
                },
                (err: any) => {
                  this.closeQr();
                  reject(err);
                }
              );
            }

            if (result.status === 'requires_payment_method' || result.status === 'canceled') {
              this.closeQr();
              return reject(new CbError({name: 'PAYMENT_INTENT_FAILED', message: 'UPI payment failed or expired'}));
            }

            this.pollTimeoutId = setTimeout(poll, POLL_INTERVAL_MS);
          })
          .catch((err: any) => {
            this.closeQr();
            reject(err instanceof CbError ? err : new CbError(err));
          });
      };

      this.pollTimeoutId = setTimeout(poll, POLL_INTERVAL_MS);
    });
  }

  protected handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_CHALLENGE:
      case PaymentAttemptStatus.REQUIRES_REDIRECTION:
      case PaymentAttemptStatus.PENDING_AUTHORIZATION: {
        const payload = paymentAttempt.action_payload || {};
        const clientSecret: string | undefined = payload.client_secret;
        const qrCodeImageUrl: string | undefined = payload.qr_code_image_url;
        const hostedInstructionsUrl: string | undefined = payload.hosted_instructions_url;

        if (!clientSecret) {
          return Promise.reject(
            new CbError({name: 'GATEWAY_ERROR', message: 'Missing client_secret in UPI payment attempt payload'})
          );
        }

        // Mobile path: Stripe's hosted_instructions_url is device-aware — on mobile it shows
        // a UPI app selector that deep-links into the chosen app (GPay, PhonePe, etc.).
        // Opening it in a new tab keeps the checkout page and its polling alive, so we do
        // not need a full-page redirect + return URL flow (same split used by RazorpayUpiHandler).
        // pollStripeUntilDone runs in the background and closes this tab on completion.
        if (Helpers.isMobileOrTablet() && hostedInstructionsUrl) {
          this.mobileWindow = window.open(hostedInstructionsUrl, '_blank');
          return this.pollStripeUntilDone(clientSecret);
        }

        // Desktop path: unchanged — render QR in our LightBox and poll Stripe directly.
        // Completion happens on the customer's phone (external device) so we cannot rely
        // on the browser-store/return flow; direct Stripe polling is the only reliable path.
        if (!qrCodeImageUrl) {
          return Promise.reject(
            new CbError({
              name: 'GATEWAY_ERROR',
              message: 'Missing qr_code_image_url in UPI payment attempt payload',
            })
          );
        }

        this.openQr(qrCodeImageUrl);
        return this.pollStripeUntilDone(clientSecret);
      }
      default:
        return super.handlePaymentAttempt(paymentAttempt);
    }
  }
}
