import {PaymentMethodType} from '@/internal/payment-intent/types';
import {buildBillingPaymentMethodDetails} from '@/internal/common/utils';
import SouthKoreanCardsHandler from './index';

export default class StripeSouthKoreanCardsHandler extends SouthKoreanCardsHandler {
  constructor(handler: SouthKoreanCardsHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }


  initPayment() {
    const paymentMethodDetails = buildBillingPaymentMethodDetails(this.paymentInfo);

    return Promise.resolve({
      paymentMethodType: PaymentMethodType.SOUTH_KOREAN_CARDS,
      ...(paymentMethodDetails ? {paymentMethodDetails} : {}),
    });
  }
}
