import {PaymentAttemptStatus, PaymentAttempt, PaymentMethodType} from '@/internal/payment-intent/types';
import ElectronicPaymentStandardHandler from './index';

export default class MollieElectronicPaymentStandardHandler extends ElectronicPaymentStandardHandler {
  constructor(handler: ElectronicPaymentStandardHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.ELECTRONIC_PAYMENT_STANDARD,
    });
  }

  private redirectToBank(paymentAttempt: PaymentAttempt): Promise<any> {
    const rawData = paymentAttempt.action_payload;
    if (this.isRedirectMode && this.getPaymentIntent().success_url) {
      window.location.href = rawData.redirect_url;
      return new Promise(() => {});
    }

    this.windowManager.loadURL(rawData.redirect_url);
    this.windowManager.watchClose(() => this.callbackHandler.triggerCancelCallback());

    return this.pollForAuthCompletion();
  }

  handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_CHALLENGE:
      case PaymentAttemptStatus.REQUIRES_REDIRECTION: {
        return this.redirectToBank(paymentAttempt).then((data) => {
          this.setPaymentIntent(data.payment_intent);
          return this.handlePaymentAttempt(this.getPaymentAttempt());
        });
      }
    }
  }
}
