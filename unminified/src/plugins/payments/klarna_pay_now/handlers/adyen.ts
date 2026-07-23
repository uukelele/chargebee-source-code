import {PaymentAttemptStatus, PaymentAttempt} from '@/internal/payment-intent/types';
import KlarnaPayNowHandler from '@/plugins/payments/klarna_pay_now/handlers';
import {PaymentMethodType} from '@/internal/payment-intent/types';
import Errors, {CbError} from '@/hosted_fields/common/errors';

export default class AdyenKlarnaPayNowHandler extends KlarnaPayNowHandler {
  constructor(handler: KlarnaPayNowHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
  }

  private redirectToBank(paymentAttempt: PaymentAttempt): Promise<any> {
    const rawData = paymentAttempt.action_payload;
    let redirectUrl;
    if (rawData.action) {
      redirectUrl = rawData.action.url;
    } else {
      redirectUrl = rawData.redirect.url;
    }
    if (this.isRedirectMode && this.getPaymentIntent().success_url) {
      window.location.href = redirectUrl;
      return new Promise(() => {});
    }

    this.windowManager.loadURL(redirectUrl);
    this.windowManager.watchClose(() => this.callbackHandler.triggerCancelCallback());

    return this.pollForAuthCompletion();
  }

  handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_REDIRECTION: {
        return this.redirectToBank(paymentAttempt).then((data) => {
          this.setPaymentIntent(data.payment_intent);
          return this.handlePaymentAttemptStatus(this.getPaymentAttempt().status);
        });
      }
      default: {
        return Promise.resolve(true);
      }
    }
  }

  validate() {
    if (!this.hasBillingAddressInfo()) {
      this.windowManager.close();
      throw new CbError(Errors.missingKlarnaPayNowBillingAddressInfo);
    }
    return Promise.resolve(true);
  }

  private hasBillingAddressInfo(): boolean {
    if (this.paymentInfo.cardBillingAddress) {
      return !!(this.paymentInfo.cardBillingAddress.firstName && this.paymentInfo.cardBillingAddress.lastName);
    } else {
      return true;
    }
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.KLARNA_PAY_NOW,
      email: this.paymentInfo.userEmail,
      params: {country: this.paymentInfo.country},
      lineItems: this.transformLineItemData(),
      cardBillingAddress: this.paymentInfo.cardBillingAddress,
    });
  }

  transformLineItemData() {
    if (Array.isArray(this.paymentInfo.lineItems) && this.paymentInfo.lineItems.length) {
      return this.paymentInfo.lineItems.map((lineItem) => {
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
