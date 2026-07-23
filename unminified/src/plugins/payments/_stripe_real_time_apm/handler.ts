import {CbError} from '@/hosted_fields/common/errors';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {PaymentAttempt, PaymentAttemptStatus} from '@/internal/payment-intent/types';
import {loadScriptUsingPredicate} from '@/extensions/three_domain_secure/common/utils';
import LightBox from '@/extensions/three_domain_secure/common/lightbox';
import {isStripeV3Available} from '@/utils/payments/stripe';

/**
 * Stripe.js stripe.handleNextAction({ clientSecret }) behavior
 * for server-confirmed PaymentIntent next_actions:
 *
 * SUPPORTED — resolves with { paymentIntent } on completion:
 *   redirect_to_url                        → browser redirect (Bizum, Swish on mobile)
 *   swish_handle_redirect_or_display_qr_code → deep-link on mobile / QR on desktop
 *     NOTE: requires chargebee-js to run in a first-party context; fails silently in
 *     cross-origin sandboxed iframes — QR fallback via action_payload is preferred.
 *   paynow_display_qr_code                 → Stripe renders QR in a hosted modal
 *   promptpay_display_qr_code              → same
 *   upi_await_notification                 → no browser UI; awaits server push
 *
 * INFORMATIONAL / UNSUPPORTED — resolves with { error } for:
 *   payto_display_details                  → mandate-based; no redirect/QR UI needed
 *   pix_display_qr_code                    → Stripe may render QR but iframe context
 *                                            typically blocks it; use fallback.
 *
 * SetupIntent next_actions:
 *   Assumed same redirect/QR semantics where applicable. QR fallback is always used
 *   when action_payload.action_type === 'QR'.
 *
 * FALLBACK RULE:
 *   1. If action_payload.action_type === 'QR'    → skip handleNextAction; render QR via
 *      action_payload.qr_code_image_url using LightBox.
 *   2. If handleNextAction returns { error } AND qr_code_image_url is present → same.
 *   3. After either path, call pollForAuthCompletion() so backend polling drives resolution.
 *   4. client_secret is NEVER logged.
 */

const STRIPE_JS_URL = 'https://js.stripe.com/v3/';

export default class StripeRealTimeApmHandler extends PaymentIntentHandler {
  protected stripe: any;
  private gatewayCredential: {publishable_key: string};
  private qrLightbox: LightBox | null = null;

  constructor(...args) {
    super(...args);
  }

  private loadStripeJs(): Promise<any> {
    if (isStripeV3Available()) {
      return Promise.resolve();
    }
    return loadScriptUsingPredicate(STRIPE_JS_URL, () => !!isStripeV3Available());
  }

  private async fetchAndCacheCredential(): Promise<void> {
    if (!this.gatewayCredential) {
      this.gatewayCredential = await this.fetchGatewayCredential();
    }
  }

  initiateAuthorization(paymentInfo: any, callbacks?: any): Promise<any> {
    return this.loadStripeJs()
      .then(() => this.fetchAndCacheCredential())
      .then(() => {
        if (!this.gatewayCredential || !this.gatewayCredential.publishable_key) {
          throw new CbError({name: 'GATEWAY_ERROR', message: 'Stripe gateway credential or publishable key is missing'});
        }
        this.stripe = window['Stripe'](this.gatewayCredential.publishable_key);
        if (!this.stripe) {
          throw new CbError({name: 'GATEWAY_ERROR', message: 'Stripe instance could not be created'});
        }
        return super.initiateAuthorization(paymentInfo, callbacks);
      });
  }

  private openHostedInstructionsDialog(url: string): void {
    if (this.qrLightbox) {
      this.qrLightbox.close();
      this.qrLightbox.destroy();
      this.qrLightbox = null;
    }
    this.qrLightbox = new LightBox('stripe-apm-instructions');
    const iframe = this.qrLightbox.createIframe('stripe-apm-instructions-frame');
    this.qrLightbox.show();
    // window.open is blocked by popup blockers after async operations; render in our own lightbox.
    iframe.style.cssText = 'width:480px;height:520px;min-width:480px;min-height:520px;border:none;';
    iframe.src = url;
  }

  private openQrDialog(qrCodeImageUrl: string): void {
    if (this.qrLightbox) {
      this.qrLightbox.close();
      this.qrLightbox.destroy();
      this.qrLightbox = null;
    }
    this.qrLightbox = new LightBox('stripe-apm-qr');
    const iframe = this.qrLightbox.createIframe('stripe-apm-qr-frame');
    this.qrLightbox.show();
    iframe.style.cssText =
      'width:400px;height:420px;min-width:400px;min-height:420px;max-width:400px;max-height:420px;';
    iframe.onload = () => {
      const doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
      if (doc) {
        doc.open();
        doc.write(this.getQrHtml(qrCodeImageUrl));
        doc.close();
      }
      this.qrLightbox && this.qrLightbox.hideLoader();
    };
    iframe.src = 'about:blank';
  }

  private getQrHtml(qrCodeImageUrl: string): string {
    return (
      `<html><body style="display:flex;flex-direction:column;align-items:center;` +
      `justify-content:flex-start;box-sizing:border-box;padding:24px 16px;` +
      `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;gap:16px;">` +
      `<img src="${qrCodeImageUrl}" alt="Payment QR Code" style="max-width:240px;max-height:240px;"/>` +
      `<div style="font-size:14px;color:#555;text-align:center;">` +
      `Scan with your banking or payment app to complete payment.</div>` +
      `</body></html>`
    );
  }

  private closeQrDialog(): void {
    if (this.qrLightbox) {
      this.qrLightbox.close();
      this.qrLightbox.destroy();
      this.qrLightbox = null;
    }
  }

  private handleQrFlow(qrCodeImageUrl: string): Promise<any> {
    this.openQrDialog(qrCodeImageUrl);
    return this.pollForAuthCompletion().then(
      (data) => {
        this.closeQrDialog();
        return data;
      },
      (err) => {
        this.closeQrDialog();
        throw err;
      }
    );
  }

  protected handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_CHALLENGE:
      case PaymentAttemptStatus.REQUIRES_REDIRECTION: {
        const payload = paymentAttempt.action_payload || {};
        const clientSecret: string | undefined = payload.client_secret;
        const qrCodeImageUrl: string | undefined = payload.qr_code_image_url;
        const hostedInstructionsUrl: string | undefined = payload.hosted_instructions_url;

        if (clientSecret) {
          // Primary: let Stripe.js handle the next action (redirect, QR, or hosted page)
          return this.stripe
            .handleNextAction({clientSecret})
            .then((result: any) => {
              if (result && result.error) {
                // Fallback: render QR ourselves if available
                if (qrCodeImageUrl) {
                  return this.handleQrFlow(qrCodeImageUrl).then((data: any) => {
                    this.setPaymentIntent(data.payment_intent);
                    return this.handlePaymentAttemptStatus(this.getPaymentAttempt().status);
                  });
                }
                const errMsg = (result.error && result.error.message) || 'Stripe action failed';
                throw new CbError({name: 'GATEWAY_ERROR', message: errMsg});
              }
              return this.pollForAuthCompletion().then((data: any) => {
                this.setPaymentIntent(data.payment_intent);
                return this.handlePaymentAttemptStatus(this.getPaymentAttempt().status);
              });
            })
            .catch((err: any) => {
              if (err && err.statusCode === 'CANCELED') {
                this.callbackHandler && this.callbackHandler.triggerCancelCallback();
                return;
              }
              throw err instanceof CbError ? err : new CbError(err);
            });
        }

        // Fallback: render QR in our own lightbox
        if (qrCodeImageUrl) {
          return this.handleQrFlow(qrCodeImageUrl).then((data: any) => {
            this.setPaymentIntent(data.payment_intent);
            return this.handlePaymentAttemptStatus(this.getPaymentAttempt().status);
          });
        }

        // Show hosted instructions in our lightbox — window.open is blocked by popup
        // blockers when called after async operations outside a user gesture context.
        if (hostedInstructionsUrl) {
          this.openHostedInstructionsDialog(hostedInstructionsUrl);
          return this.pollForAuthCompletion().then(
            (data: any) => {
              this.closeQrDialog();
              this.setPaymentIntent(data.payment_intent);
              return this.handlePaymentAttemptStatus(this.getPaymentAttempt().status);
            },
            (err: any) => {
              this.closeQrDialog();
              throw err;
            }
          );
        }

        return Promise.reject(
          new CbError({
            name: 'GATEWAY_ERROR',
            message: 'Missing client_secret, qr_code_image_url, and hosted_instructions_url in payment attempt payload',
          })
        );
      }
      default:
        return super.handlePaymentAttempt(paymentAttempt);
    }
  }
}
