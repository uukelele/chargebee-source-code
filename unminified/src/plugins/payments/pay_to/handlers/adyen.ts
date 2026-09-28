import {PaymentOptions} from '@/hosted_fields/common/base-types';
import {CbError} from '@/hosted_fields/common/errors';
import {PaymentAttempt, PaymentAttemptStatus, PaymentMethodType} from '@/internal/payment-intent/types';
import PayToHandler from '@/plugins/payments/pay_to/handlers';
import {isObjectEmpty} from '@/utils/utility-functions';

/**
 * PayTo on Adyen.
 *
 * Unlike GoCardless, Adyen neither redirects nor returns anything to scan: it answers an `await`
 * action, because the payer approves the agreement inside their own banking app. So there is no UI
 * to put up.
 *
 * Adyen's Web SDK is not involved: its txVariant registry has no `payto` entry, so
 * `createFromAction` returns null and mounting it throws.
 *
 * Nothing is waited on here either. A payer can take hours to approve, so OpenPay reports the
 * `await` on its result code rather than as an action: the attempt arrives already `AUTHORIZED`,
 * checkout completes, and the in-progress transaction is settled later by Adyen's webhook. The
 * `REQUIRES_REDIRECTION` branch remains for an attempt that still parks there — an `await` action
 * has no URL, so `super` would have nowhere to send the payer anyway.
 */
export default class AdyenPayToHandler extends PayToHandler {
  constructor(handler: PayToHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
  }

  validate(): Promise<boolean> {
    const payTo = this.readPayToDetails();
    const hasPayId = !!payTo.payId;
    const hasBankAccount = !!(payTo.bsbNumber && payTo.accountNumber);
    if (!hasPayId && !hasBankAccount) {
      return Promise.reject(new CbError('PayTo requires either a PayID or a BSB and account number.'));
    }
    return Promise.resolve(true);
  }

  async initPayment(): Promise<any> {
    const paymentInfo: any = this.paymentInfo || {};
    const additionalData = paymentInfo.additionalData || {};
    const infoCustomer = additionalData.customer || paymentInfo.customer || {};
    const billingAddress = additionalData.billingAddress || {};
    const customerBillingAddress = infoCustomer.billingAddress || {};
    const sourceBillingAddress = !isObjectEmpty(billingAddress) ? billingAddress : customerBillingAddress;
    const email = additionalData.email || infoCustomer.email;
    const subscription = additionalData.subscription;

    return {
      paymentMethodType: PaymentMethodType.PAY_TO,
      paymentType: additionalData.paymentType,
      customer: {
        firstName: infoCustomer.firstName,
        lastName: infoCustomer.lastName,
        email,
        phone: infoCustomer.phone,
        billingAddress: {
          ...sourceBillingAddress,
          countryCode: sourceBillingAddress.countryCode,
          stateCode: sourceBillingAddress.stateCode || sourceBillingAddress.state,
        },
      },
      // OpenPay builds the PayTo agreement only when subscriptionDetails is present, and it gates
      // that on frequencyUnit. Omitting this block sends the enrolment to Adyen as a one-off, so
      // Adyen mints a single-use mandate and never emits RECURRING_CONTRACT — leaving the payment
      // method with no reusable token.
      subscription: subscription
        ? {
            frequencyUnit: subscription.frequencyUnit,
            frequencyPeriod: subscription.frequencyPeriod,
            startDate: subscription.startDate,
            endDate: subscription.endDate,
            handle: subscription.handle,
          }
        : undefined,
      paymentMethodDetails: {
        firstName: infoCustomer.firstName,
        lastName: infoCustomer.lastName,
        email,
        billingAddress: !isObjectEmpty(sourceBillingAddress) ? sourceBillingAddress : undefined,
        payTo: this.readPayToDetails(),
      },
    };
  }

  handlePayment(options: PaymentOptions | any): Promise<any> {
    return this.initiateAuthorization(options.paymentInfo, options.callbacks);
  }

  handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_REDIRECTION:
        return this.awaitApproval().then((data) => {
          this.setPaymentIntent(data.payment_intent);
          return this.handlePaymentAttemptStatus(this.getPaymentAttempt().status);
        });
      case PaymentAttemptStatus.AUTHORIZED:
      case PaymentAttemptStatus.REFUSED:
        return this.handlePaymentAttemptStatus(paymentAttempt.status);
      default:
        return super.handlePaymentAttempt(paymentAttempt);
    }
  }

  /** Waits for the payer to accept the agreement in their banking app. */
  private awaitApproval(): Promise<any> {
    // `pay_to` normally opens no tab: skipPopup suppresses it unless the caller sets
    // `useGateway`, which checkout does not. Kept for the caller that does, since Adyen would
    // have nothing to load into it — the payer approves in their own app.
    this.closeTab();
    return this.pollForAuthCompletion();
  }

  /** Only the keys the shopper supplied — Adyen rejects an empty identifier outright. */
  private readPayToDetails(): {payId?: string; accountNumber?: string; bsbNumber?: string} {
    const paymentInfo: any = this.paymentInfo || {};
    const source = (paymentInfo.additionalData && paymentInfo.additionalData.payTo) || paymentInfo.payTo || {};
    const payTo: {payId?: string; accountNumber?: string; bsbNumber?: string} = {};
    if (source.payId) {
      payTo.payId = source.payId;
    }
    if (source.accountNumber) {
      payTo.accountNumber = source.accountNumber;
    }
    if (source.bsbNumber) {
      payTo.bsbNumber = source.bsbNumber;
    }
    return payTo;
  }
}
