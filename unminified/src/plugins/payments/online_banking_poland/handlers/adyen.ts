import {PaymentAttempt, PaymentAttemptStatus} from '@/extensions/three_domain_secure/common/types';
import OnlineBankingPolandHandler from '@/plugins/payments/online_banking_poland/handlers';

export default class AdyenOnlineBankingPolandHandler extends OnlineBankingPolandHandler {
  constructor(handler: OnlineBankingPolandHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
  }

  private redirectToBank(paymentAttempt: PaymentAttempt): Promise<any> {
    const rawData = paymentAttempt.action_payload;

    this.windowManager.loadURL(rawData.action.url);

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
      default: {
        return Promise.resolve(true);
      }
    }
  }
}
