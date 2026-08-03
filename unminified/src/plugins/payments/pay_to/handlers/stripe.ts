import {PaymentMethodType} from '@/internal/payment-intent/types';
import StripeRealTimeApmHandler from '@/plugins/payments/_stripe_real_time_apm/handler';
import {isObjectEmpty} from '@/utils/utility-functions';
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
    const paymentInfo: any = this.paymentInfo || {};
    const additionalData = paymentInfo.additionalData || {};
    const infoCustomer = additionalData.customer || paymentInfo.customer || {};
    const billingAddress = additionalData.billingAddress || {};
    const infoCustomerBillingAddress = infoCustomer.billingAddress || {};
    const email = additionalData.email || infoCustomer.email;
    const payToDetails = additionalData.payTo || paymentInfo.payTo || {};
    const sourceBillingAddress = !isObjectEmpty(billingAddress) ? billingAddress : infoCustomerBillingAddress;
    const customer = {
      firstName: infoCustomer.firstName,
      lastName: infoCustomer.lastName,
      email,
      phone: infoCustomer.phone,
      billingAddress: {
        ...sourceBillingAddress,
        countryCode: sourceBillingAddress.countryCode,
        stateCode: sourceBillingAddress.stateCode || sourceBillingAddress.state,
      },
    };
    const paymentMethodDetails: any = {
      firstName: infoCustomer.firstName,
      lastName: infoCustomer.lastName,
      email,
    };
    // Forward the raw PayTo bank details (PayID or Account + BSB) when the shopper
    // supplied them for the in-app local-details flow. The backend maps these onto
    // payment_method_data[payto][...]; without them PayToDetails stays null.
    const payTo: any = {};
    if (payToDetails.payId !== undefined) payTo.payId = payToDetails.payId;
    if (payToDetails.accountNumber !== undefined) payTo.accountNumber = payToDetails.accountNumber;
    if (payToDetails.bsbNumber !== undefined) payTo.bsbNumber = payToDetails.bsbNumber;
    if (payTo.payId !== undefined || payTo.accountNumber !== undefined || payTo.bsbNumber !== undefined) {
      paymentMethodDetails.payTo = payTo;
    }
    const payload: any = {
      paymentMethodType: PaymentMethodType.PAY_TO,
      paymentType: additionalData.paymentType,
      customer,
      paymentMethodDetails,
    };
    // Only send retainPaymentMethod=false to opt out of vaulting; omitting it lets the
    // backend default to saving the mandate (mirrors the Stripe Alipay handler).
    if (paymentInfo.retainPaymentMethod === false) {
      payload.retainPaymentMethod = false;
    }
    return Promise.resolve(payload);
  }

  handlePayment(options: PaymentOptions): Promise<any> {
    return this.initiateAuthorization(options.paymentInfo, options.callbacks);
  }
}
