import {PaymentRedirectTimeouts} from '@/constants/enums';
import {KlarnaPayment} from '@/hosted_fields/common/base-types';
import {CbError} from '@/hosted_fields/common/errors';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {PaymentMethodType, PaymentAttempt, PaymentAttemptStatus} from '@/internal/payment-intent/types';
import {PaymentInfo} from '../types';

/**
 * Base handler for Stripe Klarna.
 *
 * Klarna uses a redirect-based challenge flow: after the PaymentIntent is created, the customer
 * is redirected to the Klarna page (via `windowManager.loadURL`) and chargebee-js polls the
 * PaymentIntent until it is AUTHORIZED or REFUSED.
 *
 * `handlePaymentAttempt` intercepts REQUIRES_CHALLENGE / REQUIRES_REDIRECTION statuses and
 * triggers the redirect. Other statuses (e.g. PENDING_AUTHORIZATION) are forwarded to the base
 * handler — they must not resolve as success, which would bypass the `.catch` error path.
 *
 * StripeKlarnaHandler extends this class and overrides `initPayment` to include the richer
 * confirm payload (subscription, lineItems, estimate JSON, etc.).
 * The base `initPayment` here handles the non-Stripe Klarna gateway path (minimal payload).
 */
export default class KlarnaHandler extends PaymentIntentHandler implements KlarnaPayment {
  protected declare paymentInfo: PaymentInfo;
  redirectTimeout: number = PaymentRedirectTimeouts.KLARNA;

  constructor(...args) {
    super(...args);
  }

  // Popup is pre-opened by CbInstance.handlePayment (setWindowManager); do not open again here.
  handlePayment(options: any): Promise<any> {
    return super.handlePayment(options).catch((error) => {
      this.closeTab();
      throw error;
    });
  }

  initPayment() {
    const additionalData = this.paymentInfo && this.paymentInfo.additionalData;
    const subscription = additionalData && additionalData.subscription;

    return Promise.resolve({
      paymentMethodType: PaymentMethodType.KLARNA,
      ...(subscription && {
        subscription: {...subscription},
      }),
    });
  }

  private redirectToProvider(paymentAttempt: PaymentAttempt): Promise<any> {
    const rawData = paymentAttempt.action_payload;

    if (!rawData || !rawData.redirect_url) {
      this.closeTab();
      return Promise.reject(new CbError('Redirect URL is empty'));
    }

    // windowManager is provided by CbInstance.handlePayment (redirect tab)
    this.windowManager.loadURL(rawData.redirect_url);
    return this.pollForAuthCompletion();
  }

  protected handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_CHALLENGE:
      case PaymentAttemptStatus.REQUIRES_REDIRECTION: {
        return this.redirectToProvider(paymentAttempt).then((data) => {
          this.setPaymentIntent(data.payment_intent);
          return this.handlePaymentAttemptStatus(this.getPaymentAttempt().status);
        });
      }
      default:
        // Non-redirect attempt statuses (e.g. pending_authorization, inited) must not
        // resolve the chain as success — that skips .catch and fires success incorrectly.
        return super.handlePaymentAttempt(paymentAttempt);
    }
  }
}
