import AmazonPayHandler from '@/plugins/payments/amazon_payments/handlers';
import {AmazonButtonOptions, StripeGatewayCredential, StripeAddressDetails, StripePaymentEvent} from '../types';
import {loadScriptUsingPredicate} from '@/extensions/three_domain_secure/common/utils';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {
  Callbacks,
  PaymentAttempt,
  PaymentAttemptStatus,
  PaymentIntent,
  PaymentMethodType,
} from '@/internal/payment-intent/types';
import {isStripeV3Available, getStripe} from '@/utils/payments/stripe';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import {Master as M} from '@/hosted_fields/common/enums';
import Ids from '@/constants/ids';
import {jsonify} from '@/utils/utility-functions';
import {U} from '@/utils/browser/utils';
import Utils from '@/utils/payments/utils';

const STRIPE_JS_URL = 'https://js.stripe.com/v3/';

export default class StripeAmazonPayHandler extends AmazonPayHandler {
  private gatewayCredential: StripeGatewayCredential;
  private stripe: any;
  private stripePaymentEvent: StripePaymentEvent;
  private elements: any;
  private querySelectorId: string;
  private options: AmazonButtonOptions;
  private clientSecret: string;

  constructor(handler: AmazonPayHandler, ...args) {
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

  initStripeAmazonPayment() {
    return Promise.resolve({
      payload: {
        paymentMethodType: PaymentMethodType.AMAZON_PAYMENTS,
        ...Utils.getBrowserFingerprint(),
      },
      paymentIntentId: this.getPaymentIntent().id,
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
    const stripe = window['Stripe'](this.gatewayCredential.publishable_key);
    return stripe;
  }

  /**
   * Mount Amazon Pay button
   */
  async mountPaymentButton(
    querySelector: string,
    options: AmazonButtonOptions = {
      locale: 'en_US',
      buttonColor: 'Gold',
      placement: 'Cart',
      productType: 'PayAndShip',
      chargePermissionType: 'Recurring',
    }
  ) {
    // Load Stripe and credentials in parallel
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

    // Check payment config and route accordingly
    this.kvl({
      action: 'amazon_pay_payment_config',
      mount_express_checkout_element: 'true',
      gateway: 'stripe',
    });
    this.querySelectorId = querySelector;
    this.options = options;
    return this.mountPaymentExpressElement(querySelector, options);
  }

  handlePaymentAttemptStatus(paymentAttemptStatus: PaymentAttemptStatus) {
    switch (paymentAttemptStatus) {
      case PaymentAttemptStatus.REQUIRES_CHALLENGE:
        return Promise.resolve(this.getPaymentIntent());
      case PaymentAttemptStatus.AUTHORIZED:
        this.setPaymentIntent({
          ...this.getPaymentIntent(),
        });
        this.callbackHandler.triggerSuccessCallback();
        return Promise.resolve(this.getPaymentIntent());
      case PaymentAttemptStatus.REFUSED:
        this.callbackHandler.triggerErrorCallback(this.callbackHandler.intentError());
        return Promise.reject(this.callbackHandler.intentError());
    }
    return this.handlePaymentAttempt(this.getPaymentAttempt());
  }

  getClientSecret(): Promise<string> {
    return this.initStripeAmazonPayment().then((data) => {
      return this.confirmPayment(data).then((response: any) => {
        if (
          response.active_payment_attempt &&
          response.active_payment_attempt.action_payload &&
          response.active_payment_attempt.action_payload.client_secret
        ) {
          return response.active_payment_attempt.action_payload.client_secret;
        }
        throw new CbError('No client secret found');
      });
    });
  }

  /**
   * Mount Payment Express Element for Amazon Pay
   */
  private async mountPaymentExpressElement(querySelector: string, options: AmazonButtonOptions): Promise<boolean> {
    const intent = this.getPaymentIntent();

    // Configure Elements
    const elementsOptions = {
      clientSecret: this.clientSecret,
      locale: options.locale || 'en',
    };

    this.elements = this.stripe.elements(elementsOptions);

    // Configure Express Checkout for Amazon Pay only
    const expressCheckoutOptions = {
      paymentMethods: {
        amazonPay: 'auto',
        applePay: 'never',
        googlePay: 'never',
        link: 'never',
        paypal: 'never',
        klarna: 'never',
      },
      emailRequired: true,
      shippingAddressRequired: options && options.requestShipping,
      phoneNumberRequired: options && options.requestPayerPhone,
      billingAddressRequired: options && options.requestBilling,
      requestPayerName: options && options.requestPayerName,
    };

    const expressCheckoutElement = this.elements.create('expressCheckout', expressCheckoutOptions);
    expressCheckoutElement.mount(querySelector);

    // Handle click event
    expressCheckoutElement.on('click', async (event) => {
      try {
        this.kvl({
          action: 'amazon_pay_click',
          gateway: 'stripe',
        });
        await this.callbackHandler.triggerClickCallback();
        event.resolve();
      } catch (err) {
        event.reject();
        return Promise.reject(err);
      }
    });

    // Handle payment confirmation
    expressCheckoutElement.on('confirm', async (event) => this.onPaymentMethodAvailableElement(event));

    // Handle cancellation
    expressCheckoutElement.on('cancel', () => {
      this.kvl({
        action: 'amazon_pay_cancel',
        gateway: 'stripe',
      });
      this.onCancel();
    });

    // Validate Amazon Pay availability
    return new Promise<boolean>((resolve, reject) => {
      expressCheckoutElement.on('ready', ({availablePaymentMethods}) => {
        if (availablePaymentMethods && availablePaymentMethods.amazonPay) {
          const containerEl: HTMLElement = document.querySelector(querySelector);
          if (!containerEl) {
            reject(new CbError(Errors.containerElementNotFound));
            return;
          }
          resolve(true);
        } else {
          this.kvl({
            action: 'amazon_pay_available_payment_methods',
            available_payment_methods: availablePaymentMethods,
            gateway: 'stripe',
          });
          const el = document.querySelector(querySelector);
          if (el) (el as HTMLElement).style.display = 'none';
          reject(new CbError('Amazon Pay is not supported in this browser or configuration'));
        }
      });
    });
  }

  /**
   * Handle payment method available event
   */
  private onPaymentMethodAvailableElement(event: any): Promise<any> {
    this.stripePaymentEvent = event;

    let email = event.payerEmail || null;
    if (!email && event && event.billingDetails) {
      email = event.billingDetails.email || null;
    }

    // Create payment method and confirm payment
    const elements = this.elements;

    return this.stripe
      .confirmPayment({
        elements,
        clientSecret: this.clientSecret,
        confirmParams: {
          payment_method_data: {
            type: 'amazon_pay',
          },
          return_url: window.location.origin,
        },
        redirect: 'if_required',
      })
      .then((result) => {
        if (result.error) {
          this.callbackHandler.triggerErrorCallback(new CbError(result.error));
          return Promise.reject(result.error);
        }

        return this.confirmPayment({
          paymentMethod: {id: result.paymentIntent.payment_method},
          paymentIntentId: this.getPaymentIntent().id,
          payload: {
            paymentMethodType: PaymentMethodType.AMAZON_PAYMENTS,
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
        if (stripePI && (stripePI.status === 'requires_challenge' || stripePI.status === 'requires_source_action')) {
          return this.handleExpressElementChallenge(stripePI.client_secret);
        }
      }
    }
    return Promise.resolve(result);
  }

  /**
   * Handle Express Element challenge
   */
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
      .then((confirmResult) => {
        if (confirmResult.error) {
          this.callbackHandler.triggerErrorCallback(new CbError(confirmResult.error));
          return Promise.reject(confirmResult.error);
        } else {
          return this.handleChallengeResult(confirmResult);
        }
      });
  }

  /**
   * Handle payment attempt status changes
   */
  protected handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    const payload = paymentAttempt.action_payload;
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_CHALLENGE: {
        if (!payload || !payload.client_secret) {
          return Promise.reject(new CbError('Missing client_secret in payment attempt payload'));
        }
        return this.handleExpressElementChallenge(payload.client_secret);
      }
      default:
        return Promise.reject(new CbError('UNHANDLED_PAYMENT_STATUS'));
    }
  }

  /**
   * Transform Stripe address to Chargebee format
   */
  private transformStripeAddress(addressDetails: StripeAddressDetails) {
    if (!addressDetails || !addressDetails.address) {
      return {};
    }

    const names = addressDetails.name ? addressDetails.name.split(' ') : [];
    const address = addressDetails.address;

    return {
      firstName: names[0] || '',
      lastName: names.slice(1).join(' ') || '',
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
   * Get payment data for callbacks
   */
  getPaymentData(): any {
    let names: string[] = [];
    let shippingAddress: any;
    let _email: any;

    // Safely extract values from stripePaymentEvent
    if (this.stripePaymentEvent) {
      if (this.stripePaymentEvent.payerName) {
        names = this.stripePaymentEvent.payerName.split(' ');
      }

      // For paymentExpressElement, address format is consistent
      if (this.stripePaymentEvent.shippingAddress) {
        shippingAddress = this.transformStripeAddress(this.stripePaymentEvent.shippingAddress);
      }

      if (this.stripePaymentEvent.payerEmail) {
        _email = this.stripePaymentEvent.payerEmail;
      }
    }

    const payload: any = {
      shipping_address: shippingAddress,
      customer: {
        firstName: names[0] || '',
        lastName: names.slice(1).join(' ') || '',
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

    return payload;
  }

  /**
   * Initialize callbacks with Stripe-specific completion handlers
   */
  initCallbacks(paymentInfo, callbacks: Callbacks) {
    const _callbacks: Callbacks = {
      ...callbacks,
      success: (paymentIntent) => {
        callbacks && callbacks.success && callbacks.success(paymentIntent);
      },
      error: (err) => {
        callbacks && callbacks.error && callbacks.error(err);
      },
    };
    super.initCallbacks(paymentInfo, _callbacks);
  }

  /**
   * Key-Value Logging (KVL) for debugging
   * Same implementation as Apple Pay
   */
  protected kvl(data): Promise<any> {
    const payload = {
      ...jsonify(data),
    };
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.CaptureKVL,
          data: payload,
        },
        Ids.MASTER_FRAME
      )
    );
  }
}
