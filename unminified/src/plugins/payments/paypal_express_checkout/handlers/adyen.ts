import {
  PaymentMethodType,
  PaymentAttemptStatus,
  PaymentAttempt,
  Callbacks,
  PaymentIntent,
} from '@/internal/payment-intent/types';
import PaypalHandler from '@/plugins/payments/paypal_express_checkout/handlers';
import {Options, PaymentInfo} from '../types';
import Helpers from '@/helpers';

import {loadAdyenJsAndCss, adyenCheckout} from '@/utils/payments/adyen';

const VERSION = '5.38.0';

export default class AdyenPayPalHandler extends PaypalHandler {
  private gatewayCredential: any;
  private adyenComponent: any;
  private additionalData: PaymentInfo;

  constructor(handler: PaypalHandler, ...args) {
    super(...args);
  }

  initPayment() {
    const paymentInfo: PaymentInfo = this.getAdditionalData();
    let payload = {
      paymentMethodType: PaymentMethodType.PAYPAL_EXPRESS_CHECKOUT,
    };
    if (paymentInfo.customer) {
      payload['paymentMethodDetails'] = {
        firstName: paymentInfo.customer.firstName,
        lastName: paymentInfo.customer.lastName,
        email: paymentInfo.customer.email,
        phone: paymentInfo.customer.phone,
      };
      if (paymentInfo.customer.billingAddress) {
        payload['paymentMethodDetails']['billingAddress'] = paymentInfo.customer.billingAddress;
      }
    }
    return Promise.resolve(payload);
  }

  handlePayment(callbacks?: Callbacks): Promise<PaymentIntent> {
    this.initCallbacks({}, callbacks);
    return new Promise<PaymentIntent>((resolve, reject) => {
      this.callbackHandler.setPromiseResolvers(resolve, reject);
    });
  }

  mountPaymentButton(id: string, options: Options): Promise<any> {
    this.additionalData = options.additionalData && options.additionalData();
    return Promise.all([this.fetchGatewayCredential(), loadAdyenJsAndCss(VERSION)])
      .then((args) => {
        this.gatewayCredential = args[0];
        return this.createAdyenCheckoutInst(options);
      })
      .then((checkoutInstance) => {
        return checkoutInstance
          .create('paypal', {
            ...options.style,
            configuration: {
              intent: 'authorize',
            },
            cspNonce: window._hp_csp_nonce || Helpers.getCbInstance().options.cspNonce || '',
            blockPayPalCreditButton: true,
            blockPayPalPayLaterButton: true,
            blockPayPalVenmoButton: true,
            onClick: (data, actions) => this.handleClick(data, actions),
            onError: (data) => {
              if (
                (data.name && data.name == 'ERROR' && data.message && data.message.includes('Window is closed')) ||
                data.name == 'CANCEL'
              ) {
                this.cancelPayment('payment cancelled');
              } else {
                if (data.name && data.name == 'ERROR' && data.message) {
                  this.callbackHandler.triggerErrorCallback(data.message);
                }
              }
            },
          })
          .mount(id);
      });
  }

  createAdyenCheckoutInst(options: Options): Promise<any> {
    const configuration = {
      environment: this.getAdyenEnvironment(),
      clientKey: this.gatewayCredential.client_key,
      paymentMethodsResponse: {
        paymentMethods: ['paypal'],
      },
      amount: {
        currency: this.getPaymentIntent().currency_code,
        value: this.getPaymentIntent().amount,
      },
      onSubmit: (state, component) => {
        this.adyenComponent = component;
        this.initPayment().then((payload) => {
          this.confirmPayment(payload);
        });
      },
      onAdditionalDetails: (result) => {
        const data = result && result.data;
        this.confirmPayment({
          additionalInfo: {
            paymentData: data && data.paymentData,
            details: data && data.details,
          },
        });
      },
      paymentMethodsConfiguration: {},
    };
    if (this.getAdditionalData() && Helpers.isTestSite(Helpers.getCbInstance().site)) {
      configuration['countryCode'] =
        this.getAdditionalData().customer &&
        this.getAdditionalData().customer.billingAddress &&
        this.getAdditionalData().customer.billingAddress.countryCode;
    }
    return adyenCheckout()(configuration);
  }

  handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_CHALLENGE:
      case PaymentAttemptStatus.REQUIRES_REDIRECTION: {
        const action = JSON.parse(paymentAttempt.action_payload.action);
        this.adyenComponent.handleAction(action);
        return Promise.resolve(true);
      }
      default: {
        return Promise.resolve(true);
      }
    }
  }

  adyenCheckout() {
    return window['AdyenCheckout'];
  }

  getAdyenEnvironment() {
    return Helpers.isTestSite(Helpers.getCbInstance().site) ? 'test' : 'live';
  }

  getAdditionalData(): PaymentInfo {
    return this.additionalData || {};
  }
}
