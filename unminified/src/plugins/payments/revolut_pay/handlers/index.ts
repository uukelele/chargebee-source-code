import {PaymentRedirectTimeouts} from '@/constants/enums';
import {PAYMENT_AUTH_REDIRECT_WINDOW_NAME, RevolutPayPayment} from '@/hosted_fields/common/base-types';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {PaymentMethodType, PaymentAttempt, PaymentAttemptStatus} from '@/internal/payment-intent/types';
import {PaymentInfo} from '../types';
import CbWindowManager from '@/models/cb-window-manager';
import {CbError} from '@/hosted_fields/common/errors';

export default class RevolutPayHandler extends PaymentIntentHandler implements RevolutPayPayment {
  protected declare paymentInfo: PaymentInfo;
  redirectTimeout: number = PaymentRedirectTimeouts.REVOLUT_PAY;

  constructor(...args) {
    super(...args);
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.REVOLUT_PAY,
    });
  }

  private redirectToProvider(paymentAttempt: PaymentAttempt): Promise<any> {
    const rawData = paymentAttempt.action_payload;

    if (!rawData || !rawData.redirect_url) {
      return Promise.reject(new CbError('Redirect URL is empty'));
    }

    this.windowManager = new CbWindowManager();
    this.windowManager.openDirect('', PAYMENT_AUTH_REDIRECT_WINDOW_NAME, {
      skipReferrer: true,
      showLoader: true,
      openInNewWindow: true,
    });
    this.windowManager.loadURL(rawData.redirect_url);
    return this.pollForAuthCompletion();
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
