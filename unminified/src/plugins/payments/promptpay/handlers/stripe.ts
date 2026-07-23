import {PaymentMethodType} from '@/internal/payment-intent/types';
import PromptPayHandler from './index';

/**
 * Stripe gateway handler for PromptPay. Thin wrapper — all logic in PromptPayHandler (base).
 */
export default class StripePromptPayHandler extends PromptPayHandler {
  constructor(handler: PromptPayHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.PROMPTPAY,
    });
  }
}
