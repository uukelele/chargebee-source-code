import ApplepayHandler from '@/plugins/payments/apple_pay/handlers';
import {loadScriptUsingPredicate} from '@/extensions/three_domain_secure/common/utils';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {Callbacks, PaymentAttempt, PaymentAttemptStatus, PaymentIntent} from '@/internal/payment-intent/types';
import {
  StripeGatewayCredential,
  StripeInstance,
  StripePaymentEvent,
  StripeShippingAddress,
  StripeAddress,
  StripeAddressDetails,
  PaymentCompleteStatus,
  StripeConfirmResult,
  StripePaymentIntent,
  StripePaymentRequestOptions,
  StripePaymentRequest,
  StripePaymentMethod,
  StripeMountOptions,
  StripePaymentRequestButton,
} from '@/plugins/payments/apple_pay/types';

import {mountApplePayButton} from '../utils';
import {isStripeV3Available, getStripe} from '@/utils/payments/stripe';

export default class StripeApplePayHandler extends ApplepayHandler {
  private gatewayCredential: StripeGatewayCredential;
  private stripe: StripeInstance;
  private stripePaymentEvent: StripePaymentEvent;
  private paymentRequest: StripePaymentRequest;
  private paymentRequestButton: StripePaymentRequestButton;
  private elements: any;

  constructor(handler: ApplepayHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
  }

  private createStripeInstance() {
    const stripe = this.gatewayCredential.apple_pay.stripe_account_id
      ? window['Stripe'](this.gatewayCredential.publishable_key, {
          stripeAccount: this.gatewayCredential.apple_pay.stripe_account_id,
        })
      : window['Stripe'](this.gatewayCredential.publishable_key);
    return stripe;
  }

  private preloadConfig() {
    return this.fetchGatewayCredential().then((data) => {
      this.gatewayCredential = data;
      return data;
    });
  }

  private loadStripeJS(): Promise<any> {
    if (!isStripeV3Available()) {
      return loadScriptUsingPredicate('https://js.stripe.com/v3', () => !!isStripeV3Available());
    }
    return Promise.resolve(getStripe());
  }

  private transformShippingAddress(shippingAddress: StripeShippingAddress) {
    // Base check
    if (!shippingAddress) {
      return {};
    }

    const names = shippingAddress.recipient ? shippingAddress.recipient.split(' ') : [];

    const _shippingAddress = {
      firstName: names[0] || '',
      lastName: names[1] || '',
      phone: shippingAddress.phone,
      addressLine1: shippingAddress.addressLine && shippingAddress.addressLine[0],
      addressLine2: shippingAddress.addressLine && (shippingAddress.addressLine[1] || ''),
      zip: shippingAddress.postalCode,
      stateCode: shippingAddress.region,
      city: shippingAddress.city,
      countryCode: shippingAddress.country,
    };
    return _shippingAddress;
  }

  private transformStripeAddress(addressDetails: StripeAddressDetails) {
    if (!addressDetails || !addressDetails.address) {
      return {};
    }

    const names = addressDetails.name ? addressDetails.name.split(' ') : [];
    const address: StripeAddress = addressDetails.address;
    const addressTransformer = {
      firstName: names[0] || '',
      lastName: names[1] || '',
      phone: addressDetails.phone || '',
      addressLine1: address.line1 || '',
      addressLine2: address.line2 || '',
      zip: address.postal_code || '',
      stateCode: address.state || '',
      city: address.city || '',
      countryCode: address.country || '',
    };
    return addressTransformer;
  }

  getPaymentData(): any {
    let names: string[] = [];
    let shippingAddress: any;
    let _email: any;

    // Safely extract values from stripePaymentEvent if it exists
    if (this.stripePaymentEvent) {
      if (this.stripePaymentEvent.payerName) {
        names = this.stripePaymentEvent.payerName.split(' ');
      }

      if (this.stripePaymentEvent.shippingAddress) {
        if (
          this.gatewayCredential &&
          this.gatewayCredential.apple_pay &&
          this.gatewayCredential.apple_pay.stripePaymentConfig &&
          this.gatewayCredential.apple_pay.stripePaymentConfig === 'paymentRequest'
        ) {
          shippingAddress = this.transformShippingAddress(
            this.stripePaymentEvent.shippingAddress as unknown as StripeShippingAddress
          );
        } else {
          // For paymentExpressElement, Both shippingAddress and billingAddress have same type.
          shippingAddress = this.transformStripeAddress(
            this.stripePaymentEvent.shippingAddress as unknown as StripeAddressDetails
          );
        }
      }

      if (this.stripePaymentEvent.payerEmail) {
        _email = this.stripePaymentEvent.payerEmail;
      }
    }

    const payload: any = {
      shipping_address: shippingAddress,
      customer: {
        firstName: names[0] || '',
        lastName: names[1] || '',
        email: _email,
      },
    };
    if (
      this.stripePaymentEvent &&
      this.stripePaymentEvent.paymentMethod &&
      this.stripePaymentEvent.paymentMethod.billing_details
    ) {
      payload.billing_address = this.transformStripeAddress(this.stripePaymentEvent.paymentMethod.billing_details);
    }
    if (
      this.stripePaymentEvent &&
      this.stripePaymentEvent.paymentMethod &&
      this.stripePaymentEvent.paymentMethod.card &&
      this.stripePaymentEvent.paymentMethod.card.last4
    ) {
      payload.card = {
        last4: this.stripePaymentEvent.paymentMethod.card.last4,
      };
    }
    return payload;
  }

  initCallbacks(paymentInfo, callbacks: Callbacks) {
    const _callbacks: Callbacks = {
      ...callbacks,
      success: (paymentIntent) => {
        if (
          this.gatewayCredential &&
          this.gatewayCredential.apple_pay &&
          this.gatewayCredential.apple_pay.stripePaymentConfig &&
          this.gatewayCredential.apple_pay.stripePaymentConfig === 'paymentRequest'
        ) {
          this.stripePaymentEvent.complete(PaymentCompleteStatus.SUCCESS);
        }
        callbacks && callbacks.success && callbacks.success(paymentIntent);
      },
      error: (err) => {
        if (
          this.gatewayCredential &&
          this.gatewayCredential.apple_pay &&
          this.gatewayCredential.apple_pay.stripePaymentConfig &&
          this.gatewayCredential.apple_pay.stripePaymentConfig === 'paymentRequest'
        ) {
          this.stripePaymentEvent.complete(PaymentCompleteStatus.FAIL);
        }
        callbacks && callbacks.error && callbacks.error(err);
      },
    };
    super.initCallbacks(paymentInfo, _callbacks);
  }

  private handleChallengeResult(result: StripeConfirmResult): Promise<any> {
    if (result && result.error) {
      // Report to the browser that the payment failed, prompting it to
      // re-show the payment interface, or show an error message and close
      // the payment interface.
      throw new CbError(result.error);
    } else {
      // Report to the browser that the confirmation was successful, prompting
      // it to close the browser payment method collection interface.
      if (result && result.paymentIntent) {
        const stripePI: StripePaymentIntent = result.paymentIntent;
        if (stripePI && (stripePI.status === 'requires_action' || stripePI.status === 'requires_source_action')) {
          return this.handleChallenge({client_secret: stripePI.client_secret}, {});
        }
      }
    }
  }
  private handleExpressElementChallenge(clientSecret: string): Promise<any> {
    const elements = this.elements;
    return this.stripe
      .confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: window.location.origin,
        },
        redirect: 'if_required',
      })
      .then(function (confirmResult) {
        if (confirmResult.error) {
          this.callbackHandler.triggerErrorCallback(new CbError(confirmResult.error));
        } else {
          this.handleChallengeResult(confirmResult);
        }
      });
  }

  private handleChallenge(payload: any, options: any = {handleActions: false}): Promise<any> {
    if (!payload || !payload.client_secret) return Promise.resolve();
    if (
      this.gatewayCredential &&
      this.gatewayCredential.apple_pay &&
      this.gatewayCredential.apple_pay.stripePaymentConfig &&
      this.gatewayCredential.apple_pay.stripePaymentConfig === 'paymentRequest'
    ) {
      return this.stripe
        .confirmCardPayment(payload.client_secret, {payment_method: this.stripePaymentEvent.paymentMethod.id}, options)
        .then((confirmResult) => this.handleChallengeResult(confirmResult));
    }
    return this.handleExpressElementChallenge(payload.client_secret);
  }

  protected handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    const payload = paymentAttempt.action_payload;
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_CHALLENGE: {
        return this.handleChallenge(payload);
      }
      default:
        return Promise.reject(new CbError('UNHANDLED_PAYMENT_STATUS'));
    }
  }

  private onCancel() {
    // On payment cancellation from apple pay popup
    // No action required.
    // Customer can re-attempt payment using apple pay button
    // Do not throw error callback
    this.callbackHandler.triggerCancelCallback();
  }

  private createPaymentRequest(options?: StripePaymentRequestOptions): StripePaymentRequest {
    const paymentRequest = this.stripe.paymentRequest({
      country:
        (options && options.merchantCountryCode) ||
        (this.gatewayCredential &&
          this.gatewayCredential.apple_pay &&
          this.gatewayCredential.apple_pay.merchant_country_code) ||
        'US',
      currency: this.getPaymentIntent().currency_code.toLowerCase(),
      total: {
        label: (options && options.totalLabel) || 'Total',
        amount: this.getPaymentIntent().amount,
      },
      displayItems: options && options.displayItems,
      requestPayerName: options && options.requestPayerName,
      requestPayerEmail: options && options.requestPayerEmail,
      requestShipping: options && options.requestShipping,
      shippingOptions:
        options &&
        options.shippingOptions &&
        options.shippingOptions.map((option) => {
          return {
            ...option,
            amount: this.toSubunit(option.amount),
          };
        }),
      disableWallets: ['googlePay', 'browserCard'],
      ...(options &&
        options.recurringPaymentRequest && {
          applePay: {
            recurringPaymentRequest: this.buildPaymentRequest(options.recurringPaymentRequest),
          },
        }),
    });
    return paymentRequest;
  }

  private toSubunit = (amount: string): number => {
    const num = parseFloat(amount);
    return Math.round(num * 100);
  };

  updatePaymentIntent(paymentIntent: PaymentIntent): void {
    super.updatePaymentIntent(paymentIntent);
    this.elements &&
      this.elements.update &&
      this.elements.update({
        amount: paymentIntent.amount,
        mode: paymentIntent.amount === 0 ? 'setup' : 'payment',
        currency: paymentIntent.currency_code.toLowerCase(),
      });
  }

  private buildPaymentRequest = (recurringPaymentRequest) => {
    if (!recurringPaymentRequest) return undefined;

    const {paymentDescription, regularBilling, trialBilling, billingAgreement, managementURL, tokenNotificationURL} =
      recurringPaymentRequest;

    const paymentRequest: any = {};

    if (paymentDescription) {
      paymentRequest.paymentDescription = paymentDescription;
    }

    if (regularBilling) {
      const billingWithAmount = {
        ...regularBilling,
        amount: this.toSubunit(regularBilling.amount),
      };
      paymentRequest.regularBilling = billingWithAmount;
      // paymentRequest.deferredBilling = billingWithAmount;
      // paymentRequest.automaticReloadBilling = billingWithAmount;
    }

    if (trialBilling) {
      paymentRequest.trialBilling = {
        ...trialBilling,
        amount: this.toSubunit(trialBilling.amount),
      };
    }

    if (billingAgreement) {
      paymentRequest.billingAgreement = billingAgreement;
    }

    if (managementURL) {
      paymentRequest.managementURL = managementURL;
    }

    if (tokenNotificationURL) {
      paymentRequest.tokenNotificationURL = tokenNotificationURL;
    }

    return paymentRequest;
  };

  private onPaymentMethodAvailable(event: StripePaymentEvent): Promise<any> {
    const paymentMethod: StripePaymentMethod = event.paymentMethod;
    this.stripePaymentEvent = event;

    let email = event.payerEmail || null;
    if (!email && paymentMethod && paymentMethod.billing_details) {
      email = paymentMethod.billing_details.email || null;
    }

    return this.confirmPayment({
      paymentMethodType: 'apple_pay',
      paymentMethod: {id: paymentMethod.id},
      customer: {email: email},
    })
      .then((intent: PaymentIntent) => {
        return this.handleChallengeResult(intent.active_payment_attempt.action_payload);
      })
      .catch((tokenizeErr) => {
        this.callbackHandler.triggerErrorCallback(new CbError(tokenizeErr));
      });
  }

  private onPaymentMethodAvailableElement(event: any): Promise<any> {
    if (!this.stripePaymentEvent) {
      this.stripePaymentEvent = {};
    }
    let email = event.payerEmail || null;
    if (!email && event && event.billingDetails) {
      email = event.billingDetails.email || null;
    }

    // Extract billing details from the event
    if (event.shippingAddress) {
      this.stripePaymentEvent.shippingAddress = event.shippingAddress || {};
    }
    if (event.shippingRate) {
      this.stripePaymentEvent.shippingOption = event.shippingRate || {};
    }

    // Create payment method and confirm payment
    const elements = this.elements;

    return this.stripe
      .createPaymentMethod({
        elements,
        params: {
          billing_details: event.billingDetails,
        },
      })
      .then((result) => {
        if (result.error) {
          this.callbackHandler.triggerErrorCallback(new CbError(result.error));
          return;
        }

        // Store payment method in stripePaymentEvent
        this.stripePaymentEvent.paymentMethod = result.paymentMethod;
        if (result.paymentMethod) {
          this.stripePaymentEvent.payerName = result.paymentMethod.billing_details.name || '';
          this.stripePaymentEvent.payerEmail = result.paymentMethod.billing_details.email || '';
          this.stripePaymentEvent.paymentMethod.billing_details = result.paymentMethod.billing_details || {};
        }

        return this.confirmPayment({
          paymentMethodType: 'apple_pay',
          paymentMethod: {id: result.paymentMethod.id},
          customer: {email: email},
        });
      })
      .then((intent: PaymentIntent) => {
        if (!intent) {
          return;
        }
        return this.handleChallengeResult(intent.active_payment_attempt.action_payload);
      })
      .catch((err) => {
        if (this.getPaymentAttempt() && this.getPaymentAttempt().status === PaymentAttemptStatus.REFUSED) {
          return;
        }
        this.callbackHandler.triggerErrorCallback(new CbError(err));
      });
  }

  private setupPaymentRequest(options: StripePaymentRequestOptions): StripePaymentRequest {
    const paymentRequest = this.createPaymentRequest(options);
    paymentRequest.on('cancel', () => this.onCancel());

    paymentRequest.on('paymentmethod', (event) => this.onPaymentMethodAvailable(event));
    if (options.onshippingmethodselected) {
      paymentRequest.on('shippingoptionchange', (event) => {
        // TODO we need to write a mapper to convert stripe object to apple object
        // so that we can have an uniform structure for chargebee JS user
        const callback = (updateDetails) => {
          event.updateWith(updateDetails);
        };
        options.onshippingmethodselected(event, callback);
      });
    }

    if (options.onshippingcontactselected) {
      paymentRequest.on('shippingaddresschange', (event) => {
        const callback = (updateDetails) => {
          event.updateWith(updateDetails);
        };
        options.onshippingcontactselected(event, callback);
      });
    }
    return paymentRequest;
  }

  private async mountPaymentExpressElement(
    querySelector: string,
    options: StripeMountOptions & StripePaymentRequestOptions
  ): Promise<boolean> {
    const optionsPaymentElement = {
      mode: this.getPaymentIntent().amount === 0 ? 'setup' : 'payment',
      amount: this.getPaymentIntent().amount,
      currency: this.getPaymentIntent().currency_code.toLowerCase(),
      locale: options.locale || 'en',
      paymentMethodCreation: 'manual',
      captureMethod: 'manual',
    };
    this.elements = this.stripe.elements(optionsPaymentElement);
    const lineItems =
      options &&
      options.displayItems &&
      options.displayItems.map(({label, amount}) => ({
        name: label,
        amount,
      }));
    const shippingRates =
      options &&
      options.shippingOptions &&
      options.shippingOptions.map(({id, label, amount, deliveryEstimate}) => ({
        id,
        amount: this.toSubunit(amount),
        displayName: label,
        ...(deliveryEstimate !== undefined && {deliveryEstimate}),
      }));

    const recurringRequest = this.buildPaymentRequest(options.recurringPaymentRequest);

    const applePayOption = {
      paymentMethods: {
        applePay: 'always',
        amazonPay: 'never',
        googlePay: 'never',
        link: 'never',
        paypal: 'never',
        klarna: 'never',
      },
      applePay: {
        ...(recurringRequest &&
          Object.keys(recurringRequest).length && {
            recurringPaymentRequest: recurringRequest,
            // deferredPaymentRequest: PaymentRequest,
            // automaticReloadPaymentRequest: PaymentRequest,
          }),
      },
      buttonType: {
        applePay: options.buttonType || 'plain',
      },
      buttonTheme: {
        applePay: options.buttonColor || 'black',
      },
      emailRequired: options && options.requestPayerEmail,
      shippingAddressRequired: options && options.requestShipping,
      shippingRates: shippingRates,
      lineItems: lineItems,
      phoneNumberRequired: options && options.requestPayerPhone,
      billingAddressRequired: options && (options.requestPayerName || options.requestBilling),
    };
    const expressCheckoutElement = this.elements.create('expressCheckout', applePayOption);
    expressCheckoutElement.mount(querySelector);
    expressCheckoutElement.on('click', async (event) => {
      try {
        await this.callbackHandler.triggerClickCallback();
      } catch (err) {
        return Promise.reject(err);
      }
      event.resolve();
    });

    expressCheckoutElement.on('cancel', () => this.onCancel());

    expressCheckoutElement.on('confirm', async (event) => this.onPaymentMethodAvailableElement(event));

    if (options.onshippingmethodselected) {
      expressCheckoutElement.on('shippingratechange', function (event) {
        const callback = (updateDetails) => {
          event.resolve(updateDetails);
        };
        options.onshippingmethodselected(event, callback);
      });
    }

    if (options.onshippingcontactselected) {
      expressCheckoutElement.on('shippingaddresschange', function (event) {
        const callback = (updateDetails) => {
          event.resolve(updateDetails);
        };
        options.onshippingcontactselected(event, callback);
      });
    }

    return new Promise<boolean>((resolve, reject) => {
      expressCheckoutElement.on('ready', ({availablePaymentMethods}) => {
        if (availablePaymentMethods && availablePaymentMethods.applePay) {
          const containerEl: HTMLElement = document.querySelector(querySelector);
          if (!containerEl) {
            reject(new CbError(Errors.containerElementNotFound));
            return;
          }
          resolve(true);
        } else {
          this.kvl({
            action: 'apple_pay_available_payment_methods',
            available_payment_methods: availablePaymentMethods,
            gateway: 'stripe',
          });
          const el = document.querySelector(querySelector);
          // @ts-ignore
          if (el) el.style.display = 'none';
          reject(new CbError(Errors.applePayNotSupported));
        }
      });
    });
  }

  async mountPaymentButton(querySelector: string, options: StripeMountOptions & StripePaymentRequestOptions) {
    if (!this.getPaymentIntent()) {
      throw new CbError(Errors.missingPaymentIntentForMountButton);
    }

    const [_, gatewayCredentials] = await Promise.all([this.loadStripeJS(), this.preloadConfig()]);
    this.stripe = this.createStripeInstance();
    if (!this.stripe) {
      throw new CbError(Errors.missingStripeInstance);
    }

    this.gatewayCredential = gatewayCredentials;
    if (
      this.gatewayCredential &&
      this.gatewayCredential.apple_pay &&
      this.gatewayCredential.apple_pay.stripePaymentConfig &&
      this.gatewayCredential.apple_pay.stripePaymentConfig === 'paymentRequest'
    ) {
      this.kvl({
        action: 'apple_pay_payment_config',
        stripe_payment_config: 'paymentRequest',
        gateway: 'stripe',
      });
      const paymentRequest = this.setupPaymentRequest(options);
      const onClick = async () => {
        try {
          await this.callbackHandler.triggerClickCallback();
        } catch (err) {
          return Promise.reject(err);
        }
        paymentRequest.show();
      };
      this.paymentRequest = paymentRequest;
      const canMakePayment = await paymentRequest.canMakePayment();
      if (canMakePayment) {
        const containerEl: HTMLElement = document.querySelector(querySelector);
        if (!containerEl) throw new CbError(Errors.containerElementNotFound);
        return mountApplePayButton(containerEl, options, onClick);
      } else {
        this.kvl({
          action: 'apple_pay_can_make_payment',
          can_make_payment: canMakePayment,
          gateway: 'stripe',
        });
        const el = document.querySelector(querySelector);
        // @ts-ignore
        if (el) el.style.display = 'none';
        throw new CbError(Errors.applePayNotSupported);
      }
    } else {
      this.kvl({
        action: 'apple_pay_payment_config',
        stripe_payment_config: 'paymentExpressElement',
        gateway: 'stripe',
      });
      return this.mountPaymentExpressElement(querySelector, options);
    }
  }
}
