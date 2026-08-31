import {PaymentMethodType} from '@/internal/payment-intent/types';
import DanaHandler from './index';

export default class CheckoutComDanaHandler extends DanaHandler {
  constructor(handler: DanaHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.DANA,
      paymentIntentId: this.getPaymentIntent().id,
    });
  }
}
