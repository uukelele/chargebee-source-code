import {PaymentRedirectTimeouts} from '@/constants/enums';
import {SwishPayment} from '@/hosted_fields/common/base-types';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {PaymentMethodType} from '@/internal/payment-intent/types';
import {PaymentInfo} from '../types';

export default class SwishHandler extends PaymentIntentHandler implements SwishPayment {
  protected declare paymentInfo: PaymentInfo;
  redirectTimeout: number = PaymentRedirectTimeouts.DEFAULT;

  constructor(...args) {
    super(...args);
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.SWISH,
    });
  }
}
