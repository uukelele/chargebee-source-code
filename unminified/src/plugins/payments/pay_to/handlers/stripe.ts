import {PaymentMethodType} from '@/internal/payment-intent/types';
import StripeRealTimeApmHandler from '@/plugins/payments/_stripe_real_time_apm/handler';
import PayToHandler from './index';
import {PaymentOptions} from '@/hosted_fields/common/base-types';

/**
 * Stripe PayTo handler. PayTo is a mandate-based real-time APM (Australia).
 * Stripe confirms the PI server-side; action_payload.action_type is typically 'REDIRECT'
 * or informational (payto_display_details). StripeRealTimeApmHandler handles both paths.
 */
export default class StripePayToHandler extends StripeRealTimeApmHandler {
  constructor(handler: PayToHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.PAY_TO,
    });
  }

  handlePayment(options: PaymentOptions): Promise<any> {
    return this.initiateAuthorization(options.paymentInfo, options.callbacks);
  }
}
