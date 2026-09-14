import {CbError} from '@/hosted_fields/common/errors';
import PayconiqByBancontactHandler from '@/plugins/payments/payconiq_by_bancontact/handlers';
import {PaymentInfo} from '@/plugins/payments/payconiq_by_bancontact/types';
import {
  Callbacks,
  PaymentAttempt,
  PaymentAttemptStatus,
  PaymentInfo as ThreeDSPaymentInfo,
  PaymentMethodType,
} from '@/plugins/three_domain_secure/types';

export default class MolliePayconiqByBancontactHandler extends PayconiqByBancontactHandler {
  constructor(handler: PayconiqByBancontactHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
  }

  initPayment(): Promise<any> {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.PAYCONIQ_BY_BANCONTACT,
      retainPaymentMethod: false,
      paymentType: this.paymentInfo.additionalData && this.paymentInfo.additionalData.paymentType,
    });
  }

  handlePayment(paymentInfo: PaymentInfo, callbacks?: Callbacks): Promise<any> {
    return this.initiateAuthorization(paymentInfo as ThreeDSPaymentInfo, callbacks);
  }

  private redirectToGateway(paymentAttempt: PaymentAttempt): Promise<any> {
    const rawData = paymentAttempt.action_payload;
    this.windowManager.loadURL(rawData.redirect_url);
    this.windowManager.watchClose(() => this.callbackHandler.triggerCancelCallback());
    return this.pollForAuthCompletion();
  }

  handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_REDIRECTION:
        return this.redirectToGateway(paymentAttempt).then((data) => {
          this.setPaymentIntent(data.payment_intent);
          return this.handlePaymentAttempt(this.getPaymentAttempt());
        });
      case PaymentAttemptStatus.AUTHORIZED:
        this.callbackHandler.triggerSuccessCallback();
        return Promise.resolve(this.getPaymentIntent());
      case PaymentAttemptStatus.REFUSED:
        this.callbackHandler.triggerErrorCallback(this.callbackHandler.intentError());
        return Promise.reject(this.callbackHandler.intentError());
      default:
        return Promise.reject(new CbError('UNHANDLED_PAYMENT_STATUS'));
    }
  }
}
