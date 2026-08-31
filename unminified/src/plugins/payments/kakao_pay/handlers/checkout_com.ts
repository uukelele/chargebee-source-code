import {PaymentMethodType} from '@/internal/payment-intent/types';
import KakaoPayHandler from './index';

export default class CheckoutComKakaoPayHandler extends KakaoPayHandler {
  constructor(handler: KakaoPayHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.KAKAO_PAY,
      paymentIntentId: this.getPaymentIntent().id,
    });
  }
}
