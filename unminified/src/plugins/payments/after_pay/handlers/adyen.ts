import {PaymentMethodType, Customer} from '@/internal/payment-intent/types';
import {isObjectEmpty} from '@/utils/utility-functions';
import {sanitizeCustomerInfo} from '@/internal/common/utils';
import AfterpayHandler from './index';
import type {PaymentInfo as AfterpayPaymentInfo} from '../types';

type RuntimeAdyenAfterpayAdditionalData = NonNullable<AfterpayPaymentInfo['additionalData']> & {
  subscriptionEstimateJson?: string;
  subscriptionMandateHandle?: string;
  customer?: Customer;
  paymentType?: string;
};

type RuntimeAdyenAfterpayPaymentInfo = AfterpayPaymentInfo & {
  additionalInfo?: Record<string, string>;
  additionalData?: RuntimeAdyenAfterpayAdditionalData;
  retainPaymentMethod?: boolean;
};

export default class AdyenAfterpayHandler extends AfterpayHandler {
  constructor(handler: AfterpayHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment(): Promise<any> {
    const additionalData = this.paymentInfo && this.paymentInfo.additionalData;
    const subscription = additionalData && additionalData.subscription;
    const customer = this.paymentInfo && this.paymentInfo.customer;
    const email = (customer && customer.email) || (additionalData && additionalData.email) || null;

    const resolvedAddr =
      this.paymentInfo.cardBillingAddress ||
      this.getCardBillingAddress() ||
      this.getCustomerBillingAddress() ||
      (customer && customer.billingAddress);

    const cardBillingAddress = resolvedAddr ? {...resolvedAddr} : undefined;

    // Forward the subscription-estimate / mandate signals onto additionalInfo so the backend
    // (cb-app AdyenRequest → OpenPay AdyenAfterpay) can detect trial / zero-amount-setup subscriptions
    // and build the nominal trial line items. cb-checkout sets these on paymentInfo.additionalInfo;
    // additionalData is also honoured as a fallback. Mirrors the Adyen Klarna handler.
    const runtimePaymentInfo = this.paymentInfo as RuntimeAdyenAfterpayPaymentInfo;
    const extraInfo = runtimePaymentInfo.additionalInfo;
    const runtimeAdditionalData = runtimePaymentInfo.additionalData;
    const subEstJson =
      runtimeAdditionalData && typeof runtimeAdditionalData.subscriptionEstimateJson === 'string'
        ? runtimeAdditionalData.subscriptionEstimateJson
        : undefined;
    const mandateHandle =
      runtimeAdditionalData && typeof runtimeAdditionalData.subscriptionMandateHandle === 'string'
        ? runtimeAdditionalData.subscriptionMandateHandle
        : undefined;
    const mergedAdditionalInfo: Record<string, string> = {
      ...(typeof extraInfo === 'object' && extraInfo ? extraInfo : {}),
      ...(subEstJson ? {subscriptionEstimateJson: subEstJson} : {}),
      ...(mandateHandle ? {subscriptionMandateHandle: mandateHandle} : {}),
    };
    const hasAdditionalInfoKeys = Object.keys(mergedAdditionalInfo).length > 0;

    // `PaymentAttemptInput.retainPaymentMethod` defaults to true and cb-app stores the method whenever
    // the currency can be tokenized (AUD/NZD), so a one-time collect must send `false` explicitly.
    // cb-app maps only `recurring` / `one_time` payment types, so `ONETIME` is turned into that flag
    // rather than forwarded. Only `false` is sent: omitting it keeps recurring checkouts vaulting.
    const paymentType = runtimeAdditionalData && runtimeAdditionalData.paymentType;
    const isOneTime =
      runtimePaymentInfo.retainPaymentMethod === false ||
      (typeof paymentType === 'string' && paymentType.toUpperCase() === 'ONETIME');

    // Afterpay risk checks benefit from shopper name/phone and a delivery address. OpenPay's
    // AdyenAfterpay plugin maps `customer` → shopperName/shopperEmail/telephoneNumber and
    // `shippingAddress` → Adyen deliveryAddress (falling back to billing when absent).
    const shippingAddress = this.getShippingAddress();
    const additionalCustomer = runtimeAdditionalData && runtimeAdditionalData.customer;
    const mergedCustomer = sanitizeCustomerInfo({
      ...(additionalCustomer || {}),
      ...(customer || {}),
    } as Customer);
    const hasCustomer =
      !isObjectEmpty(mergedCustomer) &&
      !!(mergedCustomer.firstName || mergedCustomer.lastName || mergedCustomer.phone || mergedCustomer.email);

    return Promise.resolve({
      paymentMethodType: PaymentMethodType.AFTER_PAY,
      email,
      ...(isOneTime ? {retainPaymentMethod: false} : {}),
      params: {country: this.paymentInfo.country},
      lineItems: this.transformLineItemData(),
      cardBillingAddress,
      ...(subscription && {
        subscription: {
          frequencyUnit: subscription.frequencyUnit,
          frequencyPeriod: subscription.frequencyPeriod,
        },
      }),
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
