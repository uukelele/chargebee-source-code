import {PaymentMethodType} from '@/internal/payment-intent/types';
import StablecoinHandler from './index';

export default class StripeStablecoinHandler extends StablecoinHandler {
  constructor(handler: StablecoinHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.STABLECOIN,
    });
  }
}
