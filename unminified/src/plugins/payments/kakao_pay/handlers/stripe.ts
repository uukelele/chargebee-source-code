import {PaymentMethodType} from '@/internal/payment-intent/types';
import KakaoPayHandler from './index';
import Utils from '@/utils/payments/utils';
import {CbError} from '@/hosted_fields/common/errors';

export default class StripeKakaoPayHandler extends KakaoPayHandler {
  constructor(handler: KakaoPayHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment() {
    const confirmData: any = {
      paymentMethodType: PaymentMethodType.KAKAO_PAY,
      paymentMethodDetails: {
        email:
          (this.paymentInfo.customer && this.paymentInfo.customer.email) ||
          (this.paymentInfo.additionalData && this.paymentInfo.additionalData.email) ||
          null,
      },
    };
    return confirmData;
  }
}
