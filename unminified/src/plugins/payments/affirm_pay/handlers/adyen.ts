import {PaymentMethodType, Customer} from '@/internal/payment-intent/types';
import {isObjectEmpty} from '@/utils/utility-functions';
import {sanitizeCustomerInfo} from '@/internal/common/utils';
import AffirmHandler from './index';
import type {PaymentInfo as AffirmPaymentInfo} from '../types';

type RuntimeAdyenAffirmAdditionalData = NonNullable<AffirmPaymentInfo['additionalData']> & {
  customer?: Customer;
};

type RuntimeAdyenAffirmPaymentInfo = AffirmPaymentInfo & {
  additionalInfo?: Record<string, string>;
  additionalData?: RuntimeAdyenAffirmAdditionalData;
};

export default class AdyenAffirmHandler extends AffirmHandler {
  constructor(handler: AffirmHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment(): Promise<any> {
    const additionalData = this.paymentInfo && this.paymentInfo.additionalData;
    const customer = this.paymentInfo && this.paymentInfo.customer;
    const email = (customer && customer.email) || (additionalData && additionalData.email) || null;

    const resolvedAddr =
      this.paymentInfo.cardBillingAddress ||
      this.getCardBillingAddress() ||
      this.getCustomerBillingAddress() ||
      (customer && customer.billingAddress);

    const cardBillingAddress = resolvedAddr ? {...resolvedAddr} : undefined;

    // Affirm is one-time only: it cannot be vaulted for renewals, so the recurring signals the
    // Adyen Klarna/Afterpay handlers forward (subscription, subscriptionEstimateJson,
    // subscriptionMandateHandle) are intentionally not sent. Without a subscription signal Adyen
    // omits storePaymentMethod/recurringProcessingModel and collects a one-time CIT authorization.
    // Any additionalInfo cb-checkout sets is still forwarded verbatim.
    const runtimePaymentInfo = this.paymentInfo as RuntimeAdyenAffirmPaymentInfo;
    const extraInfo = runtimePaymentInfo.additionalInfo;
    const runtimeAdditionalData = runtimePaymentInfo.additionalData;
    const mergedAdditionalInfo: Record<string, string> = {
      ...(typeof extraInfo === 'object' && extraInfo ? extraInfo : {}),
    };
    const hasAdditionalInfoKeys = Object.keys(mergedAdditionalInfo).length > 0;

    // Affirm risk checks benefit from shopper name/phone and a delivery address. OpenPay's AdyenAffirm
    // plugin maps `customer` → shopperName/shopperEmail/telephoneNumber and `shippingAddress` → Adyen
    // deliveryAddress (falling back to billing when absent). Mirrors the Adyen Klarna handler.
    const shippingAddress = this.getShippingAddress();
    const additionalCustomer = runtimeAdditionalData && runtimeAdditionalData.customer;
    const mergedCustomer = sanitizeCustomerInfo({
      ...(additionalCustomer || {}),
      ...(customer || {}),
    } as Customer);
    const hasCustomer =
      !isObjectEmpty(mergedCustomer) &&
      !!(mergedCustomer.firstName || mergedCustomer.lastName || mergedCustomer.phone || mergedCustomer.email);

    // `PaymentAttemptInput.retainPaymentMethod` defaults to true, and cb-app derives
    // `storePaymentMethod` from it — so omitting it is a request to store. Adyen cannot vault Affirm at
    // all, so unlike Klarna this is unconditional rather than caller-driven. Today it is redundant with
    // `isTokenizationSupported`, which is false for Affirm; sending it keeps the request one-time even if
    // that gate moves, instead of reaching Adyen as a CIT and failing with OPERATION_NOT_SUPPORTED.
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.AFFIRM_PAY,
      email,
      retainPaymentMethod: false,
      params: {country: this.paymentInfo.country},
      lineItems: this.transformLineItemData(),
      cardBillingAddress,
      ...(shippingAddress && !isObjectEmpty(shippingAddress) ? {shippingAddress: {...shippingAddress}} : {}),
      ...(hasCustomer ? {customer: mergedCustomer} : {}),
      ...(hasAdditionalInfoKeys ? {additionalInfo: mergedAdditionalInfo} : {}),
    });
  }

  transformLineItemData() {
    const lineItems = this.paymentInfo.lineItems;

    if (Array.isArray(lineItems) && lineItems.length) {
      return lineItems.map((lineItem) => {
        return {
          amount: lineItem.amount,
          description: lineItem.description,
          unitAmount: lineItem.unitAmount,
          taxAmount: lineItem.taxAmount,
          id: lineItem.id,
          quantity: lineItem.quantity,
        };
      });
    } else {
      return [];
    }
  }
}
