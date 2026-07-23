import PaypalHandler from '@/plugins/payments/paypal_express_checkout/handlers';
import {loadScriptUsingPredicate} from '@/extensions/three_domain_secure/common/utils';
import {isStripeV3Available, getStripe} from '@/utils/payments/stripe';
import {
  StripeGatewayCredential,
  StripeInstance,
  StripePaypalOptions,
  StripePaymentEvent,
  StripeAddressDetails,
  Address,
} from '@/plugins/payments/paypal_express_checkout/types';
import Errors, {CbError} from '@/hosted_fields/common/errors';

import {PaymentMethodType, PaymentAttemptStatus, Callbacks, PaymentIntent} from '@/internal/payment-intent/types';

const STRIPE_JS_URL = 'https://js.stripe.com/v3/';

export default class StripePaypalHandler extends PaypalHandler {
  private gatewayCredential: StripeGatewayCredential;
  private stripe: StripeInstance;
  private stripePaymentEvent: StripePaymentEvent;
  private elements: any;
  private clientSecret: string;

  constructor(handler: PaypalHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
  }

  /**
   * Load Stripe.js SDK
   */
  private loadStripeJS(): Promise<any> {
    if (!isStripeV3Available()) {
      return loadScriptUsingPredicate(STRIPE_JS_URL, () => !!isStripeV3Available());
    }
    return Promise.resolve(getStripe());
  }

  /**
   * Handle payment with callbacks
   */
  handlePayment(callbacks?: Callbacks): Promise<PaymentIntent> {
    this.initCallbacks({}, callbacks);
    return new Promise<PaymentIntent>((resolve, reject) => {
      this.callbackHandler.setPromiseResolvers(resolve, reject);
    });
  }

  /**
   * Preload gateway configuration
   */
  private preloadConfig() {
    return this.fetchGatewayCredential().then((data) => {
      this.gatewayCredential = data;
      return data;
    });
  }

  /**
   * Create Stripe instance with publishable key
   */
  private createStripeInstance() {
    const stripe = window['Stripe'](this.gatewayCredential.public_key);
    return stripe;
  }

  /**
   * Get client secret from payment intent
   */
  getClientSecret(): Promise<string> {
    return this.initPayment().then((data) => {
      return this.confirmPayment(data).then((response: any) => {
        if (response && response.action_payload && response.action_payload.client_secret) {
          return response.action_payload.client_secret;
        }
        throw new CbError('No client secret found');
      });
    });
  }

  updatePaymentIntent(paymentIntent: PaymentIntent): void {
    super.updatePaymentIntent(paymentIntent);
    this.getClientSecret().then((secret) => {
      this.clientSecret = secret;
      this.elements &&
        this.elements.update &&
        this.elements.update({
          clientSecret: this.clientSecret,
        });
    });
  }

  /**
   * Mount PayPal payment button
   */
  async mountPaymentButton(querySelector: string, options: StripePaypalOptions = {}): Promise<any> {
    const [_, gatewayCredentials, clientSecret] = await Promise.all([
      this.loadStripeJS(),
      this.preloadConfig(),
      this.getClientSecret(),
    ]);

    this.gatewayCredential = gatewayCredentials;
    this.clientSecret = clientSecret;

    this.stripe = this.createStripeInstance();
    if (!this.stripe) {
      throw new CbError(Errors.missingStripeInstance);
    }

    this.kvl({
      action: 'paypal_payment_config',
      mount_express_checkout_element: 'true',
      gateway: 'stripe',
    });

    return this.mountPaymentExpressElement(querySelector, options);
  }

  /**
   * Handle payment attempt status
   */
  handlePaymentAttemptStatus(paymentAttemptStatus: PaymentAttemptStatus) {
    switch (paymentAttemptStatus) {
      case PaymentAttemptStatus.REQUIRES_CHALLENGE:
        return Promise.resolve(this.getPaymentAttempt());
      case PaymentAttemptStatus.AUTHORIZED:
        this.setPaymentIntent({
          ...this.getPaymentIntent(),
          payer_info: {...this.getPayerInfo()},
        });
        this.callbackHandler.triggerSuccessCallback();
        return Promise.resolve(this.getPaymentIntent());
      case PaymentAttemptStatus.REFUSED:
        this.callbackHandler.triggerErrorCallback(this.callbackHandler.intentError());
        return Promise.reject(this.callbackHandler.intentError());
    }
    return this.handlePaymentAttempt(this.getPaymentAttempt());
  }

  /**
   * Mount Payment Express Element for PayPal
   */
  private async mountPaymentExpressElement(querySelector: string, options: StripePaypalOptions): Promise<boolean> {
    const elementsOptions = {
      clientSecret: this.clientSecret,
      locale: options.locale || 'en',
    };

    this.elements = this.stripe.elements(elementsOptions);

    const expressCheckoutOptions: any = {
      paymentMethods: {
        paypal: 'auto',
        applePay: 'never',
        googlePay: 'never',
        link: 'never',
        amazonPay: 'never',
        klarna: 'never',
      },
      emailRequired: true,
      shippingAddressRequired: (options && options.requestShipping) || false,
      phoneNumberRequired: (options && options.requestPhoneNumber) || false,
      billingAddressRequired: (options && options.requestBilling) || false,
    };

    if (options.style) {
      expressCheckoutOptions.buttonType = {
        paypal: options.style.label || 'paypal',
      };
      if (options.style.color) {
        expressCheckoutOptions.buttonTheme = {
          paypal: options.style.color,
        };
      }
    }

    const expressCheckoutElement = this.elements.create('expressCheckout', expressCheckoutOptions);
    expressCheckoutElement.mount(querySelector);

    expressCheckoutElement.on('confirm', async (event) => this.onPaymentMethodAvailableElement(event));

    expressCheckoutElement.on('cancel', () => {
      this.kvl({
        action: 'paypal_cancel',
        gateway: 'stripe',
      });
      this.onCancel();
    });

    return new Promise<boolean>((resolve, reject) => {
      expressCheckoutElement.on('ready', ({availablePaymentMethods}) => {
        if (availablePaymentMethods && availablePaymentMethods.paypal) {
          const containerEl: HTMLElement = document.querySelector(querySelector);
          if (!containerEl) {
            reject(new CbError(Errors.containerElementNotFound));
            return;
          }
          resolve(true);
        } else {
          this.kvl({
            action: 'paypal_available_payment_methods',
            available_payment_methods: availablePaymentMethods,
            gateway: 'stripe',
          });
          const el = document.querySelector(querySelector);
          if (el) (el as HTMLElement).style.display = 'none';
          reject(new CbError('PayPal is not supported in this browser or configuration'));
        }
      });
    });
  }

  /**
   * Handle payment method available event from Express Checkout Element
   */
  private onPaymentMethodAvailableElement(event: any): Promise<any> {
    this.stripePaymentEvent = event;
    const email = this.extractEmail(event);

    return this.confirmStripePayment(this.clientSecret)
      .then((result) => {
        if (result.error) {
          this.callbackHandler.triggerErrorCallback(new CbError(result.error));
          return Promise.reject(result.error);
        }

        return this.confirmPayment({
          paymentMethod: {id: result.paymentIntent.payment_method},
          paymentIntentId: this.getPaymentIntent().id,
          payload: {
            paymentMethodType: PaymentMethodType.PAYPAL_EXPRESS_CHECKOUT,
            customer: {
              email: email,
            },
          },
        });
      })
      .then((intent: PaymentIntent) => {
        if (!intent.active_payment_attempt) {
          throw new CbError('Missing active payment attempt in payment intent response');
        }
        return this.handleChallengeResult(intent.active_payment_attempt.action_payload);
      })
      .catch((err) => {
        this.callbackHandler.triggerErrorCallback(new CbError(err));
        return Promise.reject(err);
      });
  }

  /**
   * Handle payment cancellation
   */
  private onCancel() {
    this.callbackHandler.triggerCancelCallback();
  }

  /**
   * Handle challenge result from Stripe
   */
  private handleChallengeResult(result: any): Promise<any> {
    if (result && result.error) {
      throw new CbError(result.error);
    } else {
      if (result && result.paymentIntent) {
        const stripePI = result.paymentIntent;
        if (
          stripePI &&
          (stripePI.status === 'requires_action' ||
            stripePI.status === 'requires_source_action' ||
            stripePI.status === 'requires_challenge')
        ) {
          return this.handleExpressElementChallenge(stripePI.client_secret);
        }
      }
    }
    return Promise.resolve(result);
  }

  /**
   * Handle Express Element challenge (3DS, redirects, etc.)
   */
  private handleExpressElementChallenge(clientSecret: string): Promise<any> {
    return this.confirmStripePayment(clientSecret).then((confirmResult) => {
      if (confirmResult.error) {
        this.callbackHandler.triggerErrorCallback(new CbError(confirmResult.error));
        return Promise.reject(confirmResult.error);
      } else {
        return this.handleChallengeResult(confirmResult);
      }
    });
  }

  /**
   * Confirm payment with Stripe Express Checkout Element
   */
  private confirmStripePayment(clientSecret: string): Promise<any> {
    return this.stripe.confirmPayment({
      elements: this.elements,
      clientSecret,
      confirmParams: {
        return_url: window.location.origin,
      },
      redirect: 'if_required',
    });
  }

  /**
   * Extract email from payment event
   */
  private extractEmail(event: any, defaultValue: string = ''): string {
    if (event && event.payerEmail) {
      return event.payerEmail;
    }
    if (event && event.billingDetails && event.billingDetails.email) {
      return event.billingDetails.email;
    }
    return defaultValue;
  }

  /**
   * Parse full name into first and last name
   */
  private parseName(fullName: string | undefined): {firstName: string; lastName: string} {
    if (!fullName) {
      return {firstName: '', lastName: ''};
    }
    const names = fullName.split(' ');
    return {
      firstName: names[0] || '',
      lastName: names.slice(1).join(' ') || '',
    };
  }

  /**
   * Transform Stripe address to Chargebee format
   */
  private transformStripeAddress(
    addressDetails: StripeAddressDetails
  ): Partial<Address> & {firstName?: string; lastName?: string; phone?: string} {
    if (!addressDetails || !addressDetails.address) {
      return {};
    }

    const {firstName, lastName} = this.parseName(addressDetails.name);
    const address = addressDetails.address;

    return {
      firstName,
      lastName,
      phone: addressDetails.phone || '',
      addressLine1: address.line1 || '',
      addressLine2: address.line2 || '',
      zip: address.postal_code || '',
      stateCode: address.state || '',
      city: address.city || '',
      countryCode: address.country || '',
    };
  }

  /**
   * Get payer info from payment event
   */
  private getPayerInfo(): any {
    const event = this.stripePaymentEvent;

    if (!event) {
      return {};
    }

    const email = this.extractEmail(event);
    const billingName = event.billingDetails && event.billingDetails.name ? event.billingDetails.name : undefined;
    const {firstName, lastName} = this.parseName(billingName);

    const out: any = {
      customer: {
        firstName,
        lastName,
        email,
      },
    };

    if (event.billingDetails) {
      out.billing_address = this.transformStripeAddress(event.billingDetails);
    }

    if (event.shippingAddress) {
      out.shipping_address = this.transformStripeAddress(event.shippingAddress);
    }

    return out;
  }
}
