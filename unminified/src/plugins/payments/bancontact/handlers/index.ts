import {PaymentRedirectTimeouts} from '@/constants/enums';
import {BancontactPayment, PaymentOptions} from '@/hosted_fields/common/base-types';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {Callbacks, PaymentMethodType} from '@/internal/payment-intent/types';
import {PaymentInfo} from '../types';

export default class BancontactHandler extends PaymentIntentHandler implements BancontactPayment {
  protected declare paymentInfo: PaymentInfo;
  redirectTimeout: number = PaymentRedirectTimeouts.BANCONTACT;

  constructor(...args) {
    super(...args);
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.BANCONTACT,
    });
  }

  /**
   * TODO: to consume handlePayment in payment intent handler,
   * once paymentIntent is accepted as part of payment options
   * @param paymentInfo
   * @param callbacks
   * @returns
   */
  handleBancontactPayment(
    paymentInfo: PaymentInfo,
    callbacks?: Callbacks,
    isRedirectMode?: boolean,
    iframeMode?: boolean
  ): Promise<any> {
    return this.getGatewayHandler(this.getPaymentIntent()).then((handler) => {
      handler.setRedirectMode(isRedirectMode);
      handler.setIframeMode(iframeMode);
      return handler.initiateAuthorization(paymentInfo, callbacks);
    });
  }

  handlePayment(input: PaymentInfo | PaymentOptions, callbacks?: Callbacks): Promise<any> {
    let paymentInfo: PaymentInfo = input as PaymentInfo;
    let redirectMode: boolean = false;
    let iframeMode: boolean = false;
    if ((input as PaymentOptions).paymentInfo) {
      paymentInfo = (input as PaymentOptions).paymentInfo;
      redirectMode = (input as PaymentOptions).redirectMode;
      iframeMode = (input as PaymentOptions).iframeMode;
    }
    return Promise.resolve(true)
      .then(() => {
        if (input == null || !((input as PaymentOptions).paymentIntent instanceof Function)) {
          return;
        }
        paymentInfo = (input as PaymentOptions).paymentInfo;
        callbacks = (input as PaymentOptions).callbacks;
        redirectMode = (input as PaymentOptions).redirectMode;
        return (input as PaymentOptions)
          .paymentIntent()
          .then((paymentIntent) => this.setPaymentIntent(this.validatePaymentIntent(paymentIntent)));
      })
      .then(() => {
        return this.handleBancontactPayment(paymentInfo, callbacks, redirectMode, iframeMode);
      });
  }
}
