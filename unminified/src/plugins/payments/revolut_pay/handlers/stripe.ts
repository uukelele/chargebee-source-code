import {PaymentMethodType} from '@/internal/payment-intent/types';
import {buildBillingPaymentMethodDetails} from '@/internal/common/utils';
import RevolutPayHandler from './index';
import Utils from '@/utils/payments/utils';

export default class StripeRevolutPayHandler extends RevolutPayHandler {
  constructor(handler: RevolutPayHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment() {
    const paymentMethodDetails = buildBillingPaymentMethodDetails(this.paymentInfo);

    return Promise.resolve({
      paymentMethodType: PaymentMethodType.REVOLUT_PAY,
      paymentIntentId: this.getPaymentIntent().id,
      ...(paymentMethodDetails ? {paymentMethodDetails} : {}),
    });
  }
}
