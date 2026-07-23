import {PaymentRedirectTimeouts} from '@/constants/enums';
import StripeRealTimeApmHandler from '@/plugins/payments/_stripe_real_time_apm/handler';
import {Address, Customer, PaymentMethodType} from '@/internal/payment-intent/types';
import {sanitizeAddress, sanitizeCustomerInfo} from '@/internal/common/utils';
import {isObjectEmpty} from '@/utils/utility-functions';

/**
 * Bizum (Spain real-time bank payment) — Stripe only.
 * Redirect-based: stripe.handleNextAction with redirect_to_url next_action.
 */
export default class BizumHandler extends StripeRealTimeApmHandler {
  redirectTimeout: number = PaymentRedirectTimeouts.BIZUM;

  constructor(...args) {
    super(...args);
  }

  initPayment() {
    const additionalData = this.paymentInfo && this.paymentInfo.additionalData;
    const billingAddress = additionalData && (additionalData.billingAddress as Address);
    const customerBillingAddress = additionalData && (additionalData.customerBillingAddress as Address);
    const customer = sanitizeCustomerInfo({
      ...((additionalData && additionalData.customer) || {}),
      ...(this.paymentInfo && this.paymentInfo.customer ? this.paymentInfo.customer : {}),
    } as Customer);
    const paymentMethodDetails: Record<string, unknown> = {};
    const sanitizedBillingAddress = sanitizeAddress(billingAddress);
    const sanitizedCustomerBillingAddress = sanitizeAddress(customerBillingAddress);
    if (!isObjectEmpty(sanitizedBillingAddress)) {
      paymentMethodDetails.billingAddress = sanitizedBillingAddress;
    }
    if (additionalData && additionalData.email) {
      paymentMethodDetails.email = additionalData.email;
    }
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.BIZUM,
      ...(!isObjectEmpty(paymentMethodDetails) ? {paymentMethodDetails} : {}),
      ...(!isObjectEmpty(sanitizedBillingAddress) ? {billingAddress: sanitizedBillingAddress} : {}),
      ...(!isObjectEmpty(sanitizedCustomerBillingAddress)
        ? {customerBillingAddress: sanitizedCustomerBillingAddress}
        : {}),
      ...(!isObjectEmpty(customer) ? {customer} : {}),
      ...(additionalData && additionalData.email ? {email: additionalData.email} : {}),
      ...(additionalData && additionalData.phone ? {phone: additionalData.phone} : {}),
      ...(additionalData && additionalData.paymentType ? {paymentType: additionalData.paymentType} : {}),
    });
  }
}
