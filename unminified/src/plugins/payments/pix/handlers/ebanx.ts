import PixHandler from '@/plugins/payments/pix/handlers/index';
import {PaymentAttempt, PaymentAttemptStatus} from '@/internal/payment-intent/types';
import Helpers from '@/helpers';

/**
 * DLocal gateway-specific PIX handler
 * DLocal is the primary gateway for PIX payments
 */
export default class DLocalPixHandler extends PixHandler {
  constructor(handler: PixHandler, ...args) {
    super(...args);
    // Copy properties from parent handler
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  protected handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_REDIRECTION:
      case PaymentAttemptStatus.REQUIRES_CHALLENGE: {
        this.markPaymentAttemptsAsAuthorized();
        return this.redirectToProvider(paymentAttempt).then((data) => {
          this.setPaymentIntent(data.payment_intent);
          return this.handlePaymentAttempt(this.getPaymentAttempt());
        });
      }
    }
  }

  private markPaymentAttemptsAsAuthorized(): void {
    if (Helpers.isTestSite(Helpers.getCbInstance().site)) {
      setTimeout(() => {
        this.confirmPayment();
      }, 5000);
    }
  }
}
