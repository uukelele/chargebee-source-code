import {PaymentMethodType} from '@/internal/payment-intent/types';
import AlipayHandler from './index';

export default class CheckoutComAlipayHandler extends AlipayHandler {
  constructor(handler: AlipayHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.ALIPAY,
      paymentIntentId: this.getPaymentIntent().id,
    });
  }
}
