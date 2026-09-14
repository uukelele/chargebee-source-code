import {PaymentMethodType} from '@/internal/payment-intent/types';
import {buildBillingPaymentMethodDetails} from '@/internal/common/utils';
import KakaoPayHandler from './index';
import {CbError} from '@/hosted_fields/common/errors';

export default class StripeKakaoPayHandler extends KakaoPayHandler {
  constructor(handler: KakaoPayHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment() {
    const paymentMethodDetails = buildBillingPaymentMethodDetails(this.paymentInfo);
    if (!paymentMethodDetails || !paymentMethodDetails.email) {
      throw new CbError({
        name: 'email_required',
        message: 'An email address is required to pay with Kakao Pay.',
      });
    }

    const confirmData: any = {
      paymentMethodType: PaymentMethodType.KAKAO_PAY,
      paymentMethodDetails,
    };
    return confirmData;
  }
}
