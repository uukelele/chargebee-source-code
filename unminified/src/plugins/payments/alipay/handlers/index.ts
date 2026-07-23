import {PaymentRedirectTimeouts} from '@/constants/enums';
import {AlipayPayment, PAYMENT_AUTH_REDIRECT_WINDOW_NAME} from '@/hosted_fields/common/base-types';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {PaymentMethodType, PaymentAttempt, PaymentAttemptStatus} from '@/internal/payment-intent/types';
import {PaymentInfo} from '../types';
import {CbError} from '@/hosted_fields/common/errors';
import CbWindowManager from '@/models/cb-window-manager';

export default class AlipayHandler extends PaymentIntentHandler implements AlipayPayment {
  protected declare paymentInfo: PaymentInfo;
  redirectTimeout: number = PaymentRedirectTimeouts.ALIPAY;

  constructor(...args) {
    super(...args);
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.ALIPAY,
    });
  }

  private redirectToProvider(paymentAttempt: PaymentAttempt): Promise<any> {
    const rawData = paymentAttempt.action_payload;

    if (!rawData || !rawData.redirect_url) {
      return Promise.reject(new CbError('Return URL is empty'));
    }

    if (this.isRedirectMode && this.getPaymentIntent().success_url) {
      window.location.href = rawData.redirect_url;
      return new Promise(() => {});
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
      case PaymentAttemptStatus.REQUIRES_REDIRECTION: {
        return this.redirectToProvider(paymentAttempt).then((data) => {
          this.setPaymentIntent(data.payment_intent);
          return this.handlePaymentAttempt(this.getPaymentAttempt());
        });
      }
    }
  }
}
