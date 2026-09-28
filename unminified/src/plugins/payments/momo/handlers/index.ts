import {MomoPayment, PAYMENT_AUTH_REDIRECT_WINDOW_NAME} from '@/hosted_fields/common/base-types';
import {CbError} from '@/hosted_fields/common/errors';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {PaymentAttempt, PaymentAttemptStatus, PaymentMethodType} from '@/internal/payment-intent/types';
import CbWindowManager from '@/models/cb-window-manager';
import {PaymentRedirectTimeouts} from '@/constants/enums';
import {PaymentInfo} from '../types';

// Redirect + poll only — payload shape is gateway-specific (see handlers/dlocal.ts, handlers/adyen.ts).
export default class MomoHandler extends PaymentIntentHandler implements MomoPayment {
  protected declare paymentInfo: PaymentInfo;
  redirectTimeout: number = PaymentRedirectTimeouts.MOMO;

  constructor(...args) {
    super(...args);
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.MOMO,
    });
  }

  private redirectToProvider(paymentAttempt: PaymentAttempt): Promise<any> {
    const rawData = paymentAttempt.action_payload;

    if (!rawData || !rawData.redirect_url) {
      return Promise.reject(new CbError('Redirect URL is empty'));
    }

    this.windowManager = new CbWindowManager({redirectMode: this.isRedirectMode});
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
      case PaymentAttemptStatus.AUTHORIZED: {
        this.callbackTriggered = true;
        this.callbackHandler.triggerSuccessCallback();
        return Promise.resolve(this.getPaymentIntent());
      }
      case PaymentAttemptStatus.REFUSED: {
        this.callbackTriggered = true;
        const error = this.callbackHandler.intentError();
        this.callbackHandler.triggerErrorCallback(error);
        return Promise.reject(error);
      }
    }
  }
}
