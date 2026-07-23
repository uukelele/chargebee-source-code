import {PaymentAttemptStatus, PaymentAttempt} from '@/extensions/three_domain_secure/common/types';
import NetbankingHandler from '@/plugins/payments/netbanking_emandates/handlers';

export default class RazorpayNetbankingHandler extends NetbankingHandler {
  constructor(handler: NetbankingHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
  }

  private redirectToBank(paymentAttempt: PaymentAttempt): Promise<any> {
    const rawData = paymentAttempt.action_payload;

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
      default: {
        return Promise.resolve(true);
      }
    }
  }
}
