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
    const paymentInfo: any = this.paymentInfo || {};
    const additionalData = paymentInfo.additionalData || {};
    const customer = additionalData.customer || {};
    const email = customer.email || additionalData.email;
    const taxId = additionalData.taxId || (additionalData.document && additionalData.document.number);
    const payload: any = {
      paymentMethodType: PaymentMethodType.PIX,
      paymentType: additionalData.paymentType,
      customer: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        email,
        phone: customer.phone,
      },
      paymentMethodDetails: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        email,
      },
      additionalInfo: {
        details: {
          document_id: taxId,
        },
      },
    };
    // Only send retainPaymentMethod=false to opt out of vaulting; omitting it lets the
    // backend default to saving the payment method (mirrors the Stripe Alipay handler).
    if (paymentInfo.retainPaymentMethod === false) {
      payload.retainPaymentMethod = false;
    }
    return Promise.resolve(payload);
  }
}
