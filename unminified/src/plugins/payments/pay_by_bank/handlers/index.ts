import {PaymentRedirectTimeouts} from '@/constants/enums';
import {PayByBankPayment} from '@/hosted_fields/common/base-types';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {PaymentMethodType} from '@/internal/payment-intent/types';
import {PaymentInfo} from '../types';

export default class PayByBankHandler extends PaymentIntentHandler implements PayByBankPayment {
  protected declare paymentInfo: PaymentInfo;
  redirectTimeout: number = PaymentRedirectTimeouts.PAY_BY_BANK;

  constructor(...args) {
    super(...args);
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.PAY_BY_BANK,
    });
  }
}
