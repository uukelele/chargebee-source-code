import {PaymentMethodType} from '@/internal/payment-intent/types';
import QpayHandler from './index';

export default class CheckoutComQpayHandler extends QpayHandler {
  constructor(handler: QpayHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.QPAY,
      paymentIntentId: this.getPaymentIntent().id,
    });
  }
}
