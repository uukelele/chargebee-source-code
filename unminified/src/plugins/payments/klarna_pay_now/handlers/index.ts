import {PaymentRedirectTimeouts} from '@/constants/enums';
import {KlarnaPayNowPayment, PaymentOptions} from '@/hosted_fields/common/base-types';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {Callbacks} from '@/internal/payment-intent/types';
import {PaymentInfo} from '../types';

export default class KlarnaPayNowHandler extends PaymentIntentHandler implements KlarnaPayNowPayment {
  protected declare paymentInfo: PaymentInfo;
  redirectTimeout: number = PaymentRedirectTimeouts.KLARNA_PAY_NOW;

  constructor(...args) {
    super(...args);
  }

  /**
   * TODO: to consume handlePayment in payment intent handler,
   * once paymentIntent is accepted as part of payment options
   * @param paymentInfo
   * @param callbacks
   * @returns
   */
  handleKlarnaPayNowPayment(paymentInfo: PaymentInfo, callbacks?: Callbacks, isRedirectMode?: boolean): Promise<any> {
    return this.getGatewayHandler(this.getPaymentIntent()).then((handler) => {
      handler.setRedirectMode(isRedirectMode);
      return handler.initiateAuthorization(paymentInfo, callbacks);
    });
  }

  handlePayment(input: PaymentInfo | PaymentOptions, callbacks?: Callbacks): Promise<any> {
    let paymentInfo: PaymentInfo = input as PaymentInfo;
    let redirectMode: boolean = false;
    if ((input as PaymentOptions).paymentInfo) {
      paymentInfo = (input as PaymentOptions).paymentInfo as PaymentInfo;
    }
    return Promise.resolve(true)
      .then(() => {
        if (input == null || !((input as PaymentOptions).paymentIntent instanceof Function)) {
          return;
        }
        paymentInfo = (input as PaymentOptions).paymentInfo as PaymentInfo;
        callbacks = (input as PaymentOptions).callbacks;
        redirectMode = (input as PaymentOptions).redirectMode;
        return (input as PaymentOptions)
          .paymentIntent()
          .then((paymentIntent) => this.setPaymentIntent(this.validatePaymentIntent(paymentIntent)));
      })
      .then(() => {
        return this.handleKlarnaPayNowPayment(paymentInfo, callbacks, redirectMode);
      });
  }
}
