import {PaymentAttemptStatus, PaymentAttempt, PaymentMethodType, Customer} from '@/internal/payment-intent/types';
import {CbError} from '@/hosted_fields/common/errors';
import {isObjectEmpty} from '@/utils/utility-functions';
import {sanitizeCustomerInfo} from '@/internal/common/utils';
import KlarnaHandler from './index';
import type {PaymentInfo as KlarnaPaymentInfo} from '../types';

type RuntimeAdyenKlarnaAdditionalData = NonNullable<KlarnaPaymentInfo['additionalData']> & {
  subscriptionEstimateJson?: string;
  subscriptionMandateHandle?: string;
  customer?: Customer;
};

type RuntimeAdyenKlarnaPaymentInfo = KlarnaPaymentInfo & {
  additionalInfo?: Record<string, string>;
  additionalData?: RuntimeAdyenKlarnaAdditionalData;
};

export default class AdyenKlarnaHandler extends KlarnaHandler {
  constructor(handler: KlarnaHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  private redirectToBank(paymentAttempt: PaymentAttempt): Promise<any> {
    // OpenPay AdyenKlarna puts the Klarna URL on requiresChallengeAction.redirect_url
    // (and requiresRedirectAction.redirect_url). cb-app forwards that map as confirm
    // action_payload, so we only read redirect_url — not Adyen's raw action/redirect shapes.
    const rawData = paymentAttempt.action_payload || {};
    const redirectUrl = rawData.redirect_url;

    if (!redirectUrl) {
      this.closeTab();
      return Promise.reject(new CbError('Redirect URL is empty'));
    }

    if (this.isRedirectMode && this.getPaymentIntent().success_url) {
      window.location.href = redirectUrl;
      return new Promise(() => {});
    }

    this.windowManager.loadURL(redirectUrl);
    this.windowManager.watchClose(() => this.callbackHandler.triggerCancelCallback());

    return this.pollForAuthCompletion();
  }

  protected handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_CHALLENGE:
      case PaymentAttemptStatus.REQUIRES_REDIRECTION: {
        return this.redirectToBank(paymentAttempt).then((data) => {
          this.setPaymentIntent(data.payment_intent);
          return this.handlePaymentAttemptStatus(this.getPaymentAttempt().status);
        });
      }
      default:
        return super.handlePaymentAttempt(paymentAttempt);
    }
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
    // (cb-app AdyenRequest → OpenPay AdyenKlarna) can detect trial / zero-amount-setup subscriptions
    // and build the nominal trial line items. cb-checkout sets these on paymentInfo.additionalInfo;
    // additionalData is also honoured as a fallback. Mirrors the Stripe Klarna handler.
    const runtimePaymentInfo = this.paymentInfo as RuntimeAdyenKlarnaPaymentInfo;
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

    // Klarna risk checks benefit from shopper name/phone and a delivery address. OpenPay's AdyenKlarna
    // plugin maps `customer` → shopperName/shopperEmail/telephoneNumber and `shippingAddress` → Adyen
    // deliveryAddress (falling back to billing when absent). Mirrors the Stripe Klarna handler.
    // (retainPaymentMethod is intentionally omitted: Adyen derives storage from the subscription signal
    //  via storePaymentMethod/recurringProcessingModel, not a client flag.)
    const shippingAddress = this.getShippingAddress();
    const additionalCustomer = runtimeAdditionalData && runtimeAdditionalData.customer;
    const mergedCustomer = sanitizeCustomerInfo({
      ...(additionalCustomer || {}),
      ...(customer || {}),
    } as Customer);
    const hasCustomer =
      !isObjectEmpty(mergedCustomer) && !!(mergedCustomer.firstName || mergedCustomer.lastName || mergedCustomer.phone);

    return Promise.resolve({
      paymentMethodType: PaymentMethodType.KLARNA,
      email,
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
