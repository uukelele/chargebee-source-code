import {PaymentMethodType} from '@/internal/payment-intent/types';
import PayNowHandler from './index';

/**
 * Stripe gateway handler for PayNow. Thin wrapper — all logic in PayNowHandler (base).
 */
export default class StripePayNowHandler extends PayNowHandler {
  constructor(handler: PayNowHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.PAYNOW,
    });
  }
}
