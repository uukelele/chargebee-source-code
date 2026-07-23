import {PaymentMethodType} from '@/internal/payment-intent/types';
import StripeRealTimeApmHandler from '@/plugins/payments/_stripe_real_time_apm/handler';
import PixHandler from './index';

/**
 * Stripe Pix handler. Delegates all challenge/QR/poll logic to StripeRealTimeApmHandler.
 * Stripe confirms the PI server-side; action_payload carries client_secret + qr_code_image_url.
 */
export default class StripePixHandler extends StripeRealTimeApmHandler {
  constructor(handler: PixHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.PIX,
    });
  }
}
