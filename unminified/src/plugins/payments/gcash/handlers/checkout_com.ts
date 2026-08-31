import {PaymentMethodType} from '@/internal/payment-intent/types';
import GcashHandler from './index';

export default class CheckoutComGcashHandler extends GcashHandler {
  constructor(handler: GcashHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.GCASH,
      paymentIntentId: this.getPaymentIntent().id,
    });
  }
}
