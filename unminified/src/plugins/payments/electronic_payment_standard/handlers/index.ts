import {PaymentRedirectTimeouts} from '@/constants/enums';
import {ElectronicPaymentStandardPayment, PaymentOptions} from '@/hosted_fields/common/base-types';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {Callbacks, PaymentMethodType} from '@/internal/payment-intent/types';
import {PaymentInfo} from '../types';

export default class ElectronicPaymentStandardHandler
  extends PaymentIntentHandler
  implements ElectronicPaymentStandardPayment
{
  protected declare paymentInfo: PaymentInfo;
  redirectTimeout: number = PaymentRedirectTimeouts.ELECTRONIC_PAYMENT_STANDARD;

  constructor(...args) {
    super(...args);
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.ELECTRONIC_PAYMENT_STANDARD,
    });
  }
}
