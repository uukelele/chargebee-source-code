import {PaymentRedirectTimeouts} from '@/constants/enums';
import {AlipayHkPayment} from '@/hosted_fields/common/base-types';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {PaymentMethodType} from '@/internal/payment-intent/types';
import {PaymentInfo} from '../types';

export default class AlipayHkHandler extends PaymentIntentHandler implements AlipayHkPayment {
  protected declare paymentInfo: PaymentInfo;
  redirectTimeout: number = PaymentRedirectTimeouts.ALIPAY_HK;

  constructor(...args) {
    super(...args);
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.ALIPAY_HK,
    });
  }
}
