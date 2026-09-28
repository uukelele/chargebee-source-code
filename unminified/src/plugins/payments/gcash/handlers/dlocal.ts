import {PaymentMethodType} from '@/internal/payment-intent/types';
import {PaymentAddress} from '@/hosted_fields/common/base-types';
import GcashHandler from './index';
import type {PaymentInfo as GcashPaymentInfo} from '../types';

// lineItems isn't in the public types — widen locally (same pattern as Klarna's RuntimeKlarnaAdditionalData).
type RuntimeAdditionalData = NonNullable<GcashPaymentInfo['additionalData']> & {
  lineItems?: unknown[];
  billingAddress?: PaymentAddress;
};

// dLocal-only PM. Reads billingAddress with a customer fallback (see getGcashPaymentInfo() in payment-mixin.js); nothing enforced client-side.
export default class DLocalGcashHandler extends GcashHandler {
  constructor(handler: GcashHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment(): Promise<any> {
    const paymentInfo = this.paymentInfo as (GcashPaymentInfo & {additionalData?: RuntimeAdditionalData}) | undefined;
    const additionalData = paymentInfo && paymentInfo.additionalData;
    const billingAddress = additionalData && additionalData.billingAddress;
    const customer = paymentInfo && paymentInfo.customer;
    const lineItems = additionalData && additionalData.lineItems;
    const document = additionalData && additionalData.document;

    const payload: any = {
      paymentMethodType: PaymentMethodType.GCASH,
      paymentMethodDetails: {
        firstName: (billingAddress && billingAddress.firstName) || (customer && customer.firstName),
        lastName: (billingAddress && billingAddress.lastName) || (customer && customer.lastName),
        email: (additionalData && additionalData.email) || (customer && customer.email),
        phone: (billingAddress && billingAddress.phone) || (customer && customer.phone),
        country: billingAddress && billingAddress.countryCode,
        billingAddress: billingAddress
          ? {
              addressLine1: billingAddress.addressLine1,
              addressLine2: billingAddress.addressLine2,
              city: billingAddress.city,
              state: billingAddress.state,
              stateCode: billingAddress.stateCode || billingAddress.state,
              countryCode: billingAddress.countryCode,
              zip: billingAddress.zip,
            }
          : undefined,
      },
      additionalInfo: {
        details: {
          document_id: document && document.number,
        },
      },
    };

    if (Array.isArray(lineItems) && lineItems.length) {
      payload['lineItems'] = lineItems.map((lineItem) => ({...(lineItem as Record<string, unknown>)}));
    }

    return Promise.resolve(payload);
  }
}
