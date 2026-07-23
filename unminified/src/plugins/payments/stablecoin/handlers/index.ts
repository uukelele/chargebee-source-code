import {PaymentRedirectTimeouts} from '@/constants/enums';
import {StablecoinPayment} from '@/hosted_fields/common/base-types';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {PaymentMethodType, PaymentAttempt, PaymentAttemptStatus} from '@/internal/payment-intent/types';
import {PaymentInfo} from '../types';

export default class StablecoinHandler extends PaymentIntentHandler implements StablecoinPayment {
  protected declare paymentInfo: PaymentInfo;
  redirectTimeout: number = PaymentRedirectTimeouts.STABLECOIN;

  constructor(...args) {
    super(...args);
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.STABLECOIN,
    });
  }

  private redirectToProvider(paymentAttempt: PaymentAttempt): Promise<any> {
    const rawData = paymentAttempt.action_payload;

    if (this.isRedirectMode && this.getPaymentIntent().success_url) {
      window.location.href = rawData.redirect_url;
      return new Promise(() => {});
    }

    if (this.windowManager) {
      this.windowManager.loadURL(rawData.redirect_url);
      return this.pollForAuthCompletion();
    }

    window.location.href = rawData.redirect_url;
    return new Promise(() => {});
  }

  protected handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_CHALLENGE:
      case PaymentAttemptStatus.REQUIRES_REDIRECTION: {
        return this.redirectToProvider(paymentAttempt).then((data) => {
          this.setPaymentIntent(data.payment_intent);
          return this.handlePaymentAttempt(this.getPaymentAttempt());
        });
      }
    }
  }
}
