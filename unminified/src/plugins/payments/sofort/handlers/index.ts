import {PaymentRedirectTimeouts} from '@/constants/enums';
import {SofortPayment} from '@/hosted_fields/common/base-types';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {PaymentMethodType} from '@/internal/payment-intent/types';
import {PaymentInfo} from '../types';

export default class SofortHandler extends PaymentIntentHandler implements SofortPayment {
  protected declare paymentInfo: PaymentInfo;
  redirectTimeout: number = PaymentRedirectTimeouts.SOFORT;

  constructor(...args) {
    super(...args);
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.SOFORT,
    });
  }
}
