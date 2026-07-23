import {PaymentRedirectTimeouts} from '@/constants/enums';
import {GcashPayment} from '@/hosted_fields/common/base-types';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {PaymentMethodType} from '@/internal/payment-intent/types';
import {PaymentInfo} from '../types';

export default class GcashHandler extends PaymentIntentHandler implements GcashPayment {
  protected declare paymentInfo: PaymentInfo;
  redirectTimeout: number = PaymentRedirectTimeouts.GCASH;

  constructor(...args) {
    super(...args);
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.GCASH,
    });
  }
}
