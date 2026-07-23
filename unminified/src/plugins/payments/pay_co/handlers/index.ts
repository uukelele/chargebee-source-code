import {PaymentRedirectTimeouts} from '@/constants/enums';
import {PayCoPayment} from '@/hosted_fields/common/base-types';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {PaymentMethodType} from '@/internal/payment-intent/types';

export default class PayCoHandler extends PaymentIntentHandler implements PayCoPayment {
  redirectTimeout: number = PaymentRedirectTimeouts.PAY_CO;

  constructor(...args) {
    super(...args);
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.PAY_CO,
    });
  }
}
