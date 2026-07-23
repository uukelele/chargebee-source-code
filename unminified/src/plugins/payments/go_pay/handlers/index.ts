import {PaymentRedirectTimeouts} from '@/constants/enums';
import {GoPayPayment} from '@/hosted_fields/common/base-types';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {PaymentMethodType} from '@/internal/payment-intent/types';

export default class GoPayHandler extends PaymentIntentHandler implements GoPayPayment {
  redirectTimeout: number = PaymentRedirectTimeouts.GO_PAY;

  constructor(...args) {
    super(...args);
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.GO_PAY,
    });
  }
}
