import {PaymentRedirectTimeouts} from '@/constants/enums';
import {TwintPayment} from '@/hosted_fields/common/base-types';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {PaymentMethodType} from '@/internal/payment-intent/types';

export default class TwintHandler extends PaymentIntentHandler implements TwintPayment {
  redirectTimeout: number = PaymentRedirectTimeouts.TWINT;

  constructor(...args) {
    super(...args);
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.TWINT,
    });
  }
}
