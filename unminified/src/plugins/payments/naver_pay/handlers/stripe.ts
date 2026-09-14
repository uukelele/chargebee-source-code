import {PaymentMethodType} from '@/internal/payment-intent/types';
import {buildBillingPaymentMethodDetails} from '@/internal/common/utils';
import NaverPayHandler from './index';

export default class StripeNaverPayHandler extends NaverPayHandler {
  constructor(handler: NaverPayHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment() {
    const paymentMethodDetails = buildBillingPaymentMethodDetails(this.paymentInfo);
    const confirmData: any = {
      paymentMethodType: PaymentMethodType.NAVER_PAY,
      ...(paymentMethodDetails ? {paymentMethodDetails} : {}),
    };
    return confirmData;
  }
}
