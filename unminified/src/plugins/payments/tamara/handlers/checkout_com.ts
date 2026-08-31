import {PaymentMethodType} from '@/internal/payment-intent/types';
import TamaraHandler from './index';

export default class CheckoutComTamaraHandler extends TamaraHandler {
  constructor(handler: TamaraHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.TAMARA,
      paymentIntentId: this.getPaymentIntent().id,
    });
  }
}
