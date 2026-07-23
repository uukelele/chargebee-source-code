import {PaymentMethodType} from '@/internal/payment-intent/types';
import SouthKoreanCardsHandler from './index';
import Utils from '@/utils/payments/utils';

export default class StripeSouthKoreanCardsHandler extends SouthKoreanCardsHandler {
  constructor(handler: SouthKoreanCardsHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.SOUTH_KOREAN_CARDS,
    });
  }
}
