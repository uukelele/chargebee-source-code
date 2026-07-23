import {PaymentAttemptStatus, PaymentAttempt} from '@/internal/payment-intent/types';
import SofortHandler from '@/plugins/payments/sofort/handlers';

export default class AdyenSofortHandler extends SofortHandler {
  constructor(handler: SofortHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
  }

  private redirectToBank(paymentAttempt: PaymentAttempt): Promise<any> {
    const rawData = paymentAttempt.action_payload;
    let redirectUrl;
    if (rawData.action) {
      redirectUrl = rawData.action.url;
    } else {
      redirectUrl = rawData.redirect.url;
    }
    if (this.isRedirectMode && this.getPaymentIntent().success_url) {
      window.location.href = redirectUrl;
      return new Promise(() => {});
    }

    this.windowManager.loadURL(redirectUrl);

    return this.pollForAuthCompletion();
  }

  handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_REDIRECTION: {
        return this.redirectToBank(paymentAttempt).then((data) => {
          this.setPaymentIntent(data.payment_intent);
          return this.handlePaymentAttempt(this.getPaymentAttempt());
        });
      }
      default: {
        return Promise.resolve(true);
      }
    }
  }
}
