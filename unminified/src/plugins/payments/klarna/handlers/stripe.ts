import {PaymentMethodType, Customer} from '@/internal/payment-intent/types';
import KlarnaHandler from './index';
import type {PaymentInfo as KlarnaPaymentInfo} from '../types';
import {isObjectEmpty} from '@/utils/utility-functions';
import {sanitizeCustomerInfo} from '@/internal/common/utils';

type RuntimeKlarnaAdditionalData = NonNullable<KlarnaPaymentInfo['additionalData']> & {
  invoiceId?: number | string;
  lineItems?: unknown[];
  paymentType?: string;
  subscriptionEstimateJson?: string;
  subscriptionMandateHandle?: string;
  customer?: Customer;
};

type RuntimeKlarnaPaymentInfo = KlarnaPaymentInfo & {
  additionalData?: RuntimeKlarnaAdditionalData;
  additionalInfo?: Record<string, string>;
  retainPaymentMethod?: boolean;
};

/**
 * StripeKlarnaHandler builds the confirm payload for Stripe Klarna and delegates
 * redirect/poll to the base KlarnaHandler.
 *
 * cb-checkout (not chargebee-js) owns all business-flow decisions about when to include each
 * runtime field. chargebee-js only maps runtime values into the backend confirm payload shape,
 * while keeping those values out of the exposed paymentInfo type surface.
 */
export default class StripeKlarnaHandler extends KlarnaHandler {
  constructor(handler: KlarnaHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  // Constructs the typed confirm payload from paymentInfo supplied by cb-checkout.
  // Each field is optional; missing fields are omitted from the payload rather than sent as null.
  initPayment() {
    const paymentInfo = this.paymentInfo as RuntimeKlarnaPaymentInfo | undefined;
    const additionalData = paymentInfo && paymentInfo.additionalData;
    const subscription = additionalData && additionalData.subscription;
    const invoiceIdRaw = additionalData && additionalData.invoiceId;
    const customer = paymentInfo && paymentInfo.customer;
    const email = (customer && customer.email) || (additionalData && additionalData.email) || null;
    const lineItems = additionalData && additionalData.lineItems;
    const paymentType = additionalData && additionalData.paymentType;
    const subEstJson =
      additionalData && typeof additionalData.subscriptionEstimateJson === 'string'
        ? additionalData.subscriptionEstimateJson
        : undefined;
    const mandateHandle =
      additionalData && typeof additionalData.subscriptionMandateHandle === 'string'
        ? additionalData.subscriptionMandateHandle
        : undefined;

    let invoiceId: number | undefined;
    if (invoiceIdRaw != null && invoiceIdRaw !== '') {
      const n = typeof invoiceIdRaw === 'number' ? invoiceIdRaw : Number(invoiceIdRaw);
      if (Number.isFinite(n)) {
        invoiceId = n;
      }
    }
    const extraInfo = paymentInfo && paymentInfo.additionalInfo;
    const mergedAdditionalInfo: Record<string, string> = {
      ...(typeof extraInfo === 'object' && extraInfo ? extraInfo : {}),
      ...(subEstJson ? {subscriptionEstimateJson: subEstJson} : {}),
      ...(mandateHandle ? {subscriptionMandateHandle: mandateHandle} : {}),
    };
    const hasAdditionalInfoKeys = Object.keys(mergedAdditionalInfo).length > 0;

    const billForPm = this.getCustomerBillingAddress() || this.getCardBillingAddress();
    const paymentMethodDetails: Record<string, unknown> = {};
    if (email) {
      paymentMethodDetails.email = email;
    }
    if (billForPm && !isObjectEmpty(billForPm)) {
      paymentMethodDetails.billingAddress = {...billForPm};
    }

    const confirmData: any = {
      paymentMethodType: PaymentMethodType.KLARNA,
      ...(subscription && {subscription: {...subscription}}),
      ...(invoiceId != null ? {invoiceId} : {}),
      ...(Array.isArray(lineItems) && lineItems.length
        ? {lineItems: lineItems.map((lineItem) => ({...(lineItem as Record<string, unknown>)}))}
        : {}),
      ...(paymentType ? {paymentType} : {}),
      ...(hasAdditionalInfoKeys ? {additionalInfo: mergedAdditionalInfo} : {}),
    };
    if (!isObjectEmpty(paymentMethodDetails)) {
      confirmData.paymentMethodDetails = paymentMethodDetails;
    }

    const shippingAddress = this.getShippingAddress();
    if (shippingAddress && !isObjectEmpty(shippingAddress)) {
      confirmData.shippingAddress = {...shippingAddress};
    }
    const customerBillingAddress = this.getCustomerBillingAddress();
    if (customerBillingAddress && !isObjectEmpty(customerBillingAddress)) {
      confirmData.customerBillingAddress = {...customerBillingAddress};
    }

    const additionalCustomer =
      additionalData && additionalData.customer ? (additionalData.customer as Customer) : undefined;
    const mergedCustomer = sanitizeCustomerInfo({
      ...(additionalCustomer || {}),
      ...(customer || {}),
    } as Customer);
    if (
      !isObjectEmpty(mergedCustomer) &&
      (mergedCustomer.firstName || mergedCustomer.lastName || mergedCustomer.phone)
    ) {
      confirmData.customer = mergedCustomer;
    }

    if (
      (typeof paymentType === 'string' && paymentType.toUpperCase() === 'ONETIME') ||
      (paymentInfo && paymentInfo.retainPaymentMethod === false)
    ) {
      confirmData.retainPaymentMethod = false;
    }
    return Promise.resolve(confirmData);
  }
}
