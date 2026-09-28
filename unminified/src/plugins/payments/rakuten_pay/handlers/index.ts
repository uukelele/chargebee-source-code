import {PaymentRedirectTimeouts} from '@/constants/enums';
import {RakutenPayPayment} from '@/hosted_fields/common/base-types';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {PaymentMethodType} from '@/internal/payment-intent/types';
import {PaymentInfo} from '../types';

export default class RakutenPayHandler extends PaymentIntentHandler implements RakutenPayPayment {
  protected declare paymentInfo: PaymentInfo;
  redirectTimeout: number = PaymentRedirectTimeouts.RAKUTEN_PAY;

  constructor(...args) {
    super(...args);
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.RAKUTEN_PAY,
    });
  }
}
