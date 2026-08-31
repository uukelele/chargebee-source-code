import {PaymentMethodType} from '@/internal/payment-intent/types';
import AlipayHkHandler from './index';

export default class CheckoutComAlipayHkHandler extends AlipayHkHandler {
  constructor(handler: AlipayHkHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.ALIPAY_HK,
      paymentIntentId: this.getPaymentIntent().id,
    });
  }
}
