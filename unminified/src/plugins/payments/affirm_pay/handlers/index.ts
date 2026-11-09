import {PaymentRedirectTimeouts} from '@/constants/enums';
import {AffirmPayment} from '@/hosted_fields/common/base-types';
import {CbError} from '@/hosted_fields/common/errors';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {PaymentMethodType, PaymentAttempt, PaymentAttemptStatus} from '@/internal/payment-intent/types';
import {PaymentInfo} from '../types';

/**
 * Base handler for Affirm.
 *
 * Affirm uses a redirect-based challenge flow: after the PaymentIntent is created, the customer
 * is redirected to the Affirm page (via `windowManager.loadURL`) and chargebee-js polls the
 * PaymentIntent until it is AUTHORIZED or REFUSED.
 *
 * `handlePaymentAttempt` intercepts REQUIRES_CHALLENGE / REQUIRES_REDIRECTION statuses and
 * triggers the redirect. Other statuses (e.g. PENDING_AUTHORIZATION) are forwarded to the base
 * handler — they must not resolve as success, which would bypass the `.catch` error path.
 *
 * AdyenAffirmHandler extends this class and overrides `initPayment` to include the richer
 * confirm payload (lineItems, customer, shipping address, etc.).
 * The base `initPayment` here handles the non-Adyen Affirm gateway path (minimal payload).
 */
export default class AffirmHandler extends PaymentIntentHandler implements AffirmPayment {
  protected declare paymentInfo: PaymentInfo;
  redirectTimeout: number = PaymentRedirectTimeouts.AFFIRM;

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
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.AFFIRM_PAY,
    });
  }

  protected redirectToProvider(paymentAttempt: PaymentAttempt): Promise<any> {
    // OpenPay AdyenAffirm puts the Affirm URL on requiresChallengeAction.redirect_url
    // (and requiresRedirectAction.redirect_url). cb-app forwards that map as confirm
    // action_payload, so we only read redirect_url — not Adyen's raw action/redirect shapes.
    const rawData = paymentAttempt.action_payload || {};
    const redirectUrl = rawData.redirect_url;

    if (!redirectUrl) {
      this.closeTab();
      return Promise.reject(new CbError('Redirect URL is empty'));
    }

    if (this.isRedirectMode && this.getPaymentIntent().success_url) {
      window.location.href = redirectUrl;
      return new Promise(() => {});
    }

    // windowManager is provided by CbInstance.handlePayment (redirect tab)
    this.windowManager.loadURL(redirectUrl);
    this.windowManager.watchClose(() => this.callbackHandler.triggerCancelCallback());

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
