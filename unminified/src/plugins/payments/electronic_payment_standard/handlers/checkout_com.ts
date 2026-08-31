import {PaymentMethodType} from '@/internal/payment-intent/types';
import ElectronicPaymentStandardHandler from './index';

export default class CheckoutComElectronicPaymentStandardHandler extends ElectronicPaymentStandardHandler {
  constructor(handler: ElectronicPaymentStandardHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.ELECTRONIC_PAYMENT_STANDARD,
      paymentIntentId: this.getPaymentIntent().id,
    });
  }
}
