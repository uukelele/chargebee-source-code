import {PaymentRedirectTimeouts} from '@/constants/enums';
import {DirectDebitPayment, PaymentOptions} from '@/hosted_fields/common/base-types';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {Callbacks} from '@/extensions/three_domain_secure/common/types';
import {PaymentInfo} from '../types';
import {DirectDebitDataHelper} from '../helper/direct-debit-data-helper';
import {DirectDebitDataManager} from '../helper/direct-debit-data-manager';

export default class DirectDebitHandler extends PaymentIntentHandler implements DirectDebitPayment {
  protected declare paymentInfo: PaymentInfo;
  redirectTimeout: number = PaymentRedirectTimeouts.DIRECT_DEBIT;
  /**
   * @deprecated Use DataManager instead of DataHelper
   */
  ddDataHelper: DirectDebitDataHelper;
  ddDataManager: DirectDebitDataManager;

  constructor(...args) {
    super(...args);
  }

  handleDirectDebitPayment(paymentInfo: PaymentInfo, callbacks?: Callbacks): Promise<any> {
    return this.getDirectDebitGatewayHandler(this.getPaymentIntent()).then((handler) =>
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
        return this.handleDirectDebitPayment(paymentInfo, callbacks);
      });
  }
}
