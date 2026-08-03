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
    return this.upiHandler.initPayment().then((paymentData: any) => {
      // GATEENGG-27427: One-time Stripe UPI (Pay Now / one-time checkout) must not be vaulted.
      // Map paymentType=ONETIME → backend retainPaymentMethod=false, the same signal Stripe
      // Klarna/Alipay handlers use so OpenPay collects a one-time CIT PaymentIntent (no mandate).
      // Scoped to Stripe UPI (this handler); Razorpay/dLocal UPI are untouched.
      const paymentType = paymentData && paymentData.paymentType;
      const retainPaymentMethod = (this.paymentInfo as {retainPaymentMethod?: boolean}).retainPaymentMethod;
      if (
        (typeof paymentType === 'string' && paymentType.toUpperCase() === 'ONETIME') ||
        retainPaymentMethod === false
      ) {
        paymentData.retainPaymentMethod = false;
      }
      return paymentData;
    });
  }

  private writeQrIframeDocument(iframe: HTMLIFrameElement, qrCodeImageUrl: string): void {
    const doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
    if (!doc) {
      return;
    }
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
    if (this.qrLightboxUpi) {
      this.qrLightboxUpi.hideLoader();
    }
  }

  private openQr(qrCodeImageUrl: string): void {
    this.qrLightboxUpi = new LightBox('stripe-upi-qr');
    const iframe = this.qrLightboxUpi.createIframe('stripe-upi-qr-frame');
    this.qrLightboxUpi.show();
    iframe.style.cssText =
      'width:400px;height:420px;min-width:400px;min-height:420px;max-width:400px;max-height:420px;';
    iframe.onload = () => {
      this.writeQrIframeDocument(iframe, qrCodeImageUrl);
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

  private isWebhookRaceConfirmError(err: any): boolean {
    const msg: string = (err && err.message) || '';
    // On mobile the hosted-instructions return path and our Stripe poll can both drive
    // completion; whichever loses the race confirms an already-authorized/consumed intent.
    // These strings are only returned once the intent is terminally good; confirmAfterWebhookRace
    // re-verifies via a fresh retrieve and only succeeds on an AUTHORIZED attempt.
    return (
      msg === 'Payment intent is authorized' ||
      msg === 'Payment intent is consumed' ||
      msg === 'Invalid Attempt status'
    );
  }

  private confirmAfterWebhookRace(err: any): Promise<any> {
    return retrievePaymentIntent(this.getPaymentIntent().id).then((data: any) => {
      this.setPaymentIntent(data.payment_intent);
      const attempt = this.getPaymentAttempt();
      if (attempt && attempt.status === PaymentAttemptStatus.AUTHORIZED) {
        return this.handlePaymentAttemptStatus(attempt.status);
      }
      throw err instanceof CbError ? err : new CbError(err);
    });
  }

  private completeChargebeePayment(): Promise<any> {
    return this.confirmPayment().catch((err: any) => {
      if (this.isWebhookRaceConfirmError(err)) {
        return this.confirmAfterWebhookRace(err);
      }
      throw err instanceof CbError ? err : new CbError(err);
    });
  }

  private isTerminalStripeSuccess(status: string | undefined): boolean {
    return status === 'succeeded' || status === 'requires_capture';
  }

  private isTerminalStripeFailure(status: string | undefined): boolean {
    return status === 'requires_payment_method' || status === 'canceled';
  }

  private async pollStripeOnce(clientSecret: string): Promise<any> {
    const result = await this.retrieveStripeIntent(clientSecret);

    if (result.error) {
      this.closeQr();
      throw new CbError({name: 'GATEWAY_ERROR', message: result.error.message});
    }

    if (this.isTerminalStripeSuccess(result.status)) {
      try {
        const data = await this.completeChargebeePayment();
        this.closeQr();
        return data;
      } catch (err) {
        this.closeQr();
        throw err;
      }
    }

    if (this.isTerminalStripeFailure(result.status)) {
      this.closeQr();
      throw new CbError({name: 'PAYMENT_INTENT_FAILED', message: 'UPI payment failed or expired'});
    }

    return undefined;
  }

  private delayPoll(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.pollTimeoutId = setTimeout(resolve, ms);
    });
  }

  private pollStripeUntilDone(clientSecret: string): Promise<any> {
    const startTime = Date.now();

    const poll = async (): Promise<any> => {
      if (Date.now() - startTime > MAX_POLL_DURATION_MS) {
        this.closeQr();
        throw new CbError({name: 'GATEWAY_ERROR', message: 'UPI payment timed out after 5 minutes'});
      }

      try {
        const data = await this.pollStripeOnce(clientSecret);
        if (data !== undefined) {
          return data;
        }
      } catch (err) {
        if (err instanceof CbError) {
          throw err;
        }
        this.closeQr();
        throw new CbError(err);
      }

      await this.delayPoll(POLL_INTERVAL_MS);
      return poll();
    };

    return this.delayPoll(POLL_INTERVAL_MS).then(() => poll());
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
