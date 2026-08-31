import AbstractGooglePayHandler from '@/extensions/payments/google_pay/handlers/abstract';
import CbInstanceOptions from '@/interfaces/cb-instance-options';
import DirectGooglePayHandler from '@/extensions/payments/google_pay/handlers/google';
import BraintreeGooglePayHandler from '@/extensions/payments/google_pay/handlers/braintree';
import DeutscheBankGooglePayHandler from '@/extensions/payments/google_pay/handlers/deutsche_bank';
import {PaymentIntent, Options, Callbacks, Gateway} from '@/extensions/three_domain_secure/common/types';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {GooglePayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import {ButtonOption, PaymentData, PaymentRequestOptions} from '@/plugins/payments/google_pay/types';

export default class GooglePayHandler implements GooglePayment {
  public site: string;
  public paymentIntent: PaymentIntent;
  public paymentData: PaymentData;
  public options: Options;
  public component: any;

  private googlePayHandler: AbstractGooglePayHandler;

  constructor(chargebee: CbInstanceOptions) {
    this.site = chargebee.site;
  }

  mountPaymentButton(
    id: string,
    buttonStyle: ButtonOption = {},
    paymentRequestOptions: PaymentRequestOptions = {}
  ): Promise<any> {
    return this.googlePayHandler.mountPaymentButton(id, buttonStyle, paymentRequestOptions);
  }

  setPaymentIntent(paymentIntent: PaymentIntent, options: Options = {}) {
    this.options = options;
    this.paymentIntent = this.validatePaymentIntent(paymentIntent);
    this.googlePayHandler = this.getGooglePayHandler(this.paymentIntent.gateway);
  }

  updatePaymentIntent(paymentIntent) {
    this.paymentIntent = paymentIntent;
  }

  getPaymentIntent(): PaymentIntent {
    return this.paymentIntent;
  }

  validatePaymentIntent(intent: PaymentIntent): PaymentIntent {
    if (typeof intent !== 'object' || !(intent.id && intent.amount + '' && intent.status && intent.gateway))
      throw new CbError(Errors.invalidPaymentIntent);
    return intent;
  }

  handlePayment(callbacks?: Callbacks): Promise<any> {
    return this.googlePayHandler.handleGooglePayment(callbacks);
  }

  private getGooglePayHandler(gateway: Gateway): AbstractGooglePayHandler {
    switch (gateway) {
      case Gateway.BRAINTREE:
        return new BraintreeGooglePayHandler(this);
      case Gateway.STRIPE:
      case Gateway.ADYEN:
      case Gateway.BLUESNAP:
      case Gateway.NMI:
      case Gateway.CHECKOUT_COM:
      case Gateway.VANTIV:
      case Gateway.CHARGEBEE_PAYMENTS:
      case Gateway.WORLDPAY:
        return new DirectGooglePayHandler(this);
      case Gateway.DEUTSCHE_BANK:
        return new DeutscheBankGooglePayHandler(this);
    }
  }
}
