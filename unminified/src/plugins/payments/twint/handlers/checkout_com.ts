import {PaymentMethodType} from '@/internal/payment-intent/types';
import TwintHandler from './index';

export default class CheckoutComTwintHandler extends TwintHandler {
  constructor(handler: TwintHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.TWINT,
      paymentIntentId: this.getPaymentIntent().id,
    });
  }
}
