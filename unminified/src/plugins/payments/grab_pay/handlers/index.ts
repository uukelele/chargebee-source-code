import {PaymentRedirectTimeouts} from '@/constants/enums';
import {GrabPayPayment} from '@/hosted_fields/common/base-types';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {PaymentMethodType} from '@/internal/payment-intent/types';

export default class GrabPayHandler extends PaymentIntentHandler implements GrabPayPayment {
  redirectTimeout: number = PaymentRedirectTimeouts.GRAB_PAY;

  constructor(...args) {
    super(...args);
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.GRAB_PAY,
    });
  }
}
