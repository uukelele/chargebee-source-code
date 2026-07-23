import {PaymentRedirectTimeouts} from '@/constants/enums';
import StripeRealTimeApmHandler from '@/plugins/payments/_stripe_real_time_apm/handler';
import {Customer, PaymentMethodType} from '@/internal/payment-intent/types';
import {sanitizeCustomerInfo} from '@/internal/common/utils';
import {isObjectEmpty} from '@/utils/utility-functions';

/**
 * PayNow (Singapore real-time QR payment) — Stripe only.
 * QR-based: action_payload.action_type === 'QR' → LightBox QR dialog via StripeRealTimeApmHandler.
 * QR code expires in 60 minutes; timeout matches that window.
 */
export default class PayNowHandler extends StripeRealTimeApmHandler {
  redirectTimeout: number = PaymentRedirectTimeouts.PAYNOW;

  constructor(...args) {
    super(...args);
  }

  initPayment() {
    const additionalData = this.paymentInfo && this.paymentInfo.additionalData;
    const customer = sanitizeCustomerInfo({
      ...((additionalData && additionalData.customer) || {}),
      ...(this.paymentInfo && this.paymentInfo.customer ? this.paymentInfo.customer : {}),
    } as Customer);
    const payload: any = {
      paymentMethodType: PaymentMethodType.PAYNOW,
    };
    if (!isObjectEmpty(customer)) {
      payload.customer = customer;
    }
    if (additionalData && additionalData.email) {
      payload.email = additionalData.email;
    }
    return Promise.resolve(payload);
  }
}
