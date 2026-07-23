import {PaymentAttemptStatus, PaymentAttempt} from '@/internal/payment-intent/types';
import SofortHandler from '@/plugins/payments/sofort/handlers';

export default class CheckoutComSofortHandler extends SofortHandler {
  constructor(handler: SofortHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
  }

  private redirectToBank(paymentAttempt: PaymentAttempt): Promise<any> {
    const rawData = paymentAttempt.action_payload;

    if (this.isRedirectMode && this.getPaymentIntent().success_url) {
      window.location.href = rawData.redirect_url;
      return new Promise(() => {});
    }

    this.windowManager.loadURL(rawData.redirect_url);

    return this.pollForAuthCompletion();
  }

  handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_CHALLENGE: {
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
