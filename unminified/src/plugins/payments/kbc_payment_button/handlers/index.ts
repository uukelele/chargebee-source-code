import {PaymentRedirectTimeouts} from '@/constants/enums';
import {KbcPaymentButtonPayment, PaymentOptions} from '@/hosted_fields/common/base-types';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {Callbacks, PaymentMethodType} from '@/internal/payment-intent/types';
import {PaymentInfo} from '../types';

export default class KbcPaymentButtonHandler extends PaymentIntentHandler implements KbcPaymentButtonPayment {
  protected declare paymentInfo: PaymentInfo;
  redirectTimeout: number = PaymentRedirectTimeouts.KBC_PAYMENT_BUTTON;

  constructor(...args) {
    super(...args);
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.KBC_PAYMENT_BUTTON,
    });
  }
}
