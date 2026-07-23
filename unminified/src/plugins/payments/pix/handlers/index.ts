import {PixPayment, PAYMENT_AUTH_REDIRECT_WINDOW_NAME, BasePaymentInfo} from '@/hosted_fields/common/base-types';
import {CbError} from '@/hosted_fields/common/errors';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {PaymentMethodType, PaymentAttempt, PaymentAttemptStatus} from '@/internal/payment-intent/types';
import CbWindowManager from '@/models/cb-window-manager';
import {PaymentRedirectTimeouts} from '@/constants/enums';

export default class PixHandler extends PaymentIntentHandler implements PixPayment {
  redirectTimeout: number = PaymentRedirectTimeouts.PIX;

  constructor(...args) {
    super(...args);
  }

  initPayment() {
    const additionalData = this.paymentInfo.additionalData;
    const billingAddress = additionalData && additionalData.billingAddress;
    const shippingAddress = additionalData && additionalData.shippingAddress;
    const subscription = additionalData && additionalData.subscription;
    const document = additionalData && additionalData.document;
    const customer = this.paymentInfo.customer;

    return Promise.resolve({
      paymentMethodType: PaymentMethodType.PIX,
      paymentType: this.paymentInfo.additionalData && this.paymentInfo.additionalData.paymentType,
      allowPaylessPaymentMethodAddition:
        this.paymentInfo.additionalData && this.paymentInfo.additionalData.allowPaylessPaymentMethodAddition,
      paymentMethodDetails: {
        firstName: (billingAddress && billingAddress.firstName) || (customer && customer.firstName),
        lastName: (billingAddress && billingAddress.lastName) || (customer && customer.lastName),
        companyName: (customer && customer.company) || (billingAddress && billingAddress.company),
        email: (additionalData && additionalData.email) || (customer && customer.email),
        phone: (billingAddress && billingAddress.phone) || (customer && customer.phone),
        country: billingAddress && billingAddress.countryCode,
        billingAddress: billingAddress
          ? {
              addressLine1: billingAddress.line1 || billingAddress.addressLine1,
              addressLine2: billingAddress.line2 || billingAddress.addressLine2,
              addressLine3: billingAddress.line3 || billingAddress.addressLine3,
              city: billingAddress.city,
              state: billingAddress.state,
              stateCode: billingAddress.stateCode || billingAddress.state,
              countryCode: billingAddress.countryCode,
              zip: billingAddress.zip,
            }
          : undefined,
      },
      customer: customer
        ? {
            firstName: customer.firstName,
            lastName: customer.lastName,
            email: customer.email,
            phone: customer.phone,
            company: customer.company,
          }
        : undefined,
      shippingAddress: shippingAddress
        ? {
            firstName: shippingAddress.first_name || shippingAddress.firstName,
            lastName: shippingAddress.last_name || shippingAddress.lastName,
            phone: shippingAddress.phone,
            addressLine1: shippingAddress.line1 || shippingAddress.addressLine1,
            addressLine2: shippingAddress.line2 || shippingAddress.addressLine2,
            addressLine3: shippingAddress.line3 || shippingAddress.addressLine3,
            city: shippingAddress.city,
            state: shippingAddress.state,
            stateCode: shippingAddress.stateCode || shippingAddress.state,
            countryCode: shippingAddress.countryCode,
            zip: shippingAddress.zip,
          }
        : undefined,
      subscription: subscription
        ? {
            frequencyUnit: subscription.frequencyUnit,
            startDate: subscription.startDate,
            endDate: subscription.endDate,
            frequencyPeriod: subscription.frequencyPeriod,
          }
        : undefined,
      additionalInfo: {
        details: {
          document_id: document && document.number,
        },
      },
    });
  }

  validate(): Promise<any> {
    const paymentInfo = this.paymentInfo as BasePaymentInfo;
    const additionalData = paymentInfo && paymentInfo.additionalData;
    const billingAddress = additionalData && additionalData.billingAddress;

    // Validate billingAddress exists
    if (!paymentInfo || !billingAddress) {
      return Promise.reject(new CbError('Required payment method billing details.'));
    }

    // Validate email in billingAddress
    if (!additionalData.email) {
      return Promise.reject(new CbError('Required payment method email.'));
    }

    // Validate name in billingAddress (firstName or lastName)
    // @ts-ignore - firstName and lastName are dynamic properties
    if (!billingAddress.firstName && !billingAddress.lastName) {
      return Promise.reject(new CbError('Required payment method name.'));
    }

    // Validate document
    // @ts-ignore - document property is dynamic and not in type definition
    const document = additionalData && additionalData.document;
    if (!additionalData || !document || typeof document !== 'object' || Object.keys(document).length === 0) {
      return Promise.reject(new CbError('Required document details.'));
    }

    // Validate subscription frequencyUnit only if subscription is provided (recurring payments)
    const subscription = additionalData && additionalData.subscription;
    if (subscription) {
      const frequencyUnit = subscription.frequencyUnit;
      if (!frequencyUnit) {
        return Promise.reject(new CbError('Required subscription frequency unit.'));
      }
    }

    return Promise.resolve(true);
  }

  private redirectToProvider(paymentAttempt: PaymentAttempt): Promise<any> {
    const rawData = paymentAttempt.action_payload;

    if (!rawData || !rawData.redirect_url) {
      return Promise.reject(new CbError('Redirect URL is empty'));
    }

    if (this.windowManager) {
      this.windowManager.loadURL(rawData.redirect_url);
      return this.pollForAuthCompletion();
    }

    this.windowManager = new CbWindowManager();
    this.windowManager.openDirect('', PAYMENT_AUTH_REDIRECT_WINDOW_NAME, {
      skipReferrer: true,
      showLoader: true,
      openInNewWindow: true,
    });

    this.windowManager.loadURL(rawData.redirect_url);
    return this.pollForAuthCompletion();
  }

  protected handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_REDIRECTION:
      case PaymentAttemptStatus.REQUIRES_CHALLENGE: {
        return this.redirectToProvider(paymentAttempt).then((data) => {
          this.setPaymentIntent(data.payment_intent);
          return this.handlePaymentAttempt(this.getPaymentAttempt());
        });
      }
    }
  }
}
