import {PaymentMethodType} from '@/internal/payment-intent/types';
import {buildBillingPaymentMethodDetails} from '@/internal/common/utils';
import PaypayHandler from './index';

export default class StripePaypayHandler extends PaypayHandler {
  constructor(handler: PaypayHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment() {
    const paymentMethodDetails = buildBillingPaymentMethodDetails(this.paymentInfo);

    return Promise.resolve({
      paymentMethodType: PaymentMethodType.PAYPAY,
      ...(paymentMethodDetails ? {paymentMethodDetails} : {}),
    });
  }
}
