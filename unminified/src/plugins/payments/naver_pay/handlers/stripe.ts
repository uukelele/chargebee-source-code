import {PaymentMethodType} from '@/internal/payment-intent/types';
import NaverPayHandler from './index';

export default class StripeNaverPayHandler extends NaverPayHandler {
  constructor(handler: NaverPayHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment() {
    const confirmData: any = {
      paymentMethodType: PaymentMethodType.NAVER_PAY,
    };
    return confirmData;
  }
}
