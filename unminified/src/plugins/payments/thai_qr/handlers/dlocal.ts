import {PaymentMethodType} from '@/internal/payment-intent/types';
import {PaymentAddress} from '@/hosted_fields/common/base-types';
import ThaiQrHandler from '@/plugins/payments/thai_qr/handlers/index';
import type {PaymentInfo as ThaiQrPaymentInfo} from '../types';

// lineItems isn't in the public types — widen locally (same pattern as Klarna's RuntimeKlarnaAdditionalData).
type RuntimeAdditionalData = NonNullable<ThaiQrPaymentInfo['additionalData']> & {
  lineItems?: unknown[];
  billingAddress?: PaymentAddress;
};

// dLocal-only PM. Payload mirrors DLocalQrOnetime.buildPayer(); nothing is validated client-side.
export default class DLocalThaiQrHandler extends ThaiQrHandler {
  constructor(handler: ThaiQrHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment() {
    const paymentInfo = this.paymentInfo as ThaiQrPaymentInfo & {additionalData?: RuntimeAdditionalData};
    const additionalData = paymentInfo.additionalData;
    const billingAddress = additionalData && additionalData.billingAddress;
    const document = additionalData && additionalData.document;
    const customer = paymentInfo.customer;
    // Already in dLocal's basket shape (see thaiQrCheckout() in cbjs-transformer) — forwarded as-is.
    const lineItems = additionalData && additionalData.lineItems;

    return Promise.resolve({
      paymentMethodType: PaymentMethodType.THAI_QR,
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
      ...(Array.isArray(lineItems) && lineItems.length
        ? {lineItems: lineItems.map((lineItem) => ({...(lineItem as Record<string, unknown>)}))}
        : {}),
      additionalInfo: {
        details: {
          document_id: document && document.number,
        },
      },
    });
  }
}
