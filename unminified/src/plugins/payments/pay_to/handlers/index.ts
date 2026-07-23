import {PaymentRedirectTimeouts} from '@/constants/enums';
import {PayToPayment, PaymentOptions} from '@/hosted_fields/common/base-types';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {PaymentInfo} from '../../faster_payments/types';
import {Callbacks} from '@/extensions/three_domain_secure/common/types';

export default class PayToHandler extends PaymentIntentHandler implements PayToPayment {
  protected declare paymentInfo: PaymentInfo;
  redirectTimeout: number = PaymentRedirectTimeouts.PAY_TO;

  constructor(...args) {
    super(...args);
  }

  handlePayToPayment(paymentInfo: PaymentInfo, callbacks?: Callbacks): Promise<any> {
    return this.getGatewayHandler(this.getPaymentIntent()).then((handler) =>
      handler.handlePayment({paymentInfo, callbacks})
    );
  }

  handlePayment(input: PaymentInfo | PaymentOptions, callbacks?: Callbacks): Promise<any> {
    let paymentInfo: PaymentInfo = input as PaymentInfo;
    return Promise.resolve(true)
      .then(() => {
        if (input == null || !((input as PaymentOptions).paymentIntent instanceof Function)) {
          return;
        }
        paymentInfo = (input as PaymentOptions).paymentInfo as PaymentInfo;
        callbacks = (input as PaymentOptions).callbacks;
        return (input as PaymentOptions)
          .paymentIntent()
          .then((paymentIntent) => this.setPaymentIntent(this.validatePaymentIntent(paymentIntent)));
      })
      .then(() => {
        return this.handlePayToPayment(paymentInfo, callbacks);
      });
  }
}
