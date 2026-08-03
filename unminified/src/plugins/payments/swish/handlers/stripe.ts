import {PaymentMethodType} from '@/internal/payment-intent/types';
import StripeRealTimeApmHandler from '@/plugins/payments/_stripe_real_time_apm/handler';
import SwishHandler from './index';

/**
 * Stripe Swish handler. Swish uses stripe.handleNextAction with
 * swish_handle_redirect_or_display_qr_code next_action: deep-link on mobile, QR on desktop.
 * Falls back to QR via action_payload.qr_code_image_url in iframe contexts.
 */
export default class StripeSwishHandler extends StripeRealTimeApmHandler {
  constructor(handler: SwishHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment() {
    const paymentInfo: any = this.paymentInfo || {};
    const infoCustomer = paymentInfo.customer || {};
    const customer = {
      firstName: paymentInfo.first_name || infoCustomer.firstName,
      lastName: paymentInfo.last_name || infoCustomer.lastName,
      email: paymentInfo.email || infoCustomer.email,
      phone: paymentInfo.phone || infoCustomer.phone,
    };
    const payload: any = {
      paymentMethodType: PaymentMethodType.SWISH,
    };
    if (
      customer.firstName !== undefined ||
      customer.lastName !== undefined ||
      customer.email !== undefined ||
      customer.phone !== undefined
    ) {
      payload.customer = customer;
    }
    return Promise.resolve(payload);
  }
}
