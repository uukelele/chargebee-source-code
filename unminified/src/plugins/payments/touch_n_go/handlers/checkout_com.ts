import {PaymentMethodType} from '@/internal/payment-intent/types';
import TouchNGoHandler from './index';

export default class CheckoutComTouchNGoHandler extends TouchNGoHandler {
  constructor(handler: TouchNGoHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.TOUCH_N_GO,
      paymentIntentId: this.getPaymentIntent().id,
    });
  }
}
