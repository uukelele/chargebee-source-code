import {PaymentMethodType, PaymentIntent, Callbacks, PaymentAttemptStatus} from '@/internal/payment-intent/types';
import PaypalHandler from '@/plugins/payments/paypal_express_checkout/handlers';
import {Options} from '../types';
import {loadScript, loadScriptUsingPredicate} from '@/extensions/three_domain_secure/common/utils';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import {Master as M} from '@/hosted_fields/common/enums';
import Ids from '@/constants/ids';
import Helpers from '@/helpers';

export default class BraintreePaypalHandler extends PaypalHandler {
  private bInstance: any;
  private bPaypalCheckoutInstance: any;
  private approvedPayload: any;

  constructor(handler: PaypalHandler, ...args) {
    super(...args);
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.PAYPAL_EXPRESS_CHECKOUT,
      tmpToken: this.approvedPayload.nonce,
    });
  }

  handlePayment(callbacks: Callbacks): Promise<PaymentIntent> {
    this.initCallbacks({}, callbacks);
    return new Promise<PaymentIntent>((resolve, reject) => {
      this.callbackHandler.setPromiseResolvers(resolve, reject);
    });
  }

  mountPaymentButton(id: string, options: Options): Promise<any> {
    return Promise.all([this.generateBraintreeClientToken(), this.loadBraintreeJS()])
      .then(([response]) => this.createBraintreeClientInstance(response.client_token))
      .then((braintreeInstance) => {
        this.bInstance = braintreeInstance;
        return this.createBraintreePaypalInstance();
      })
      .then((paypalCheckoutInstance) => {
        this.bPaypalCheckoutInstance = paypalCheckoutInstance;
        // https://braintree.github.io/braintree-web/current/PayPalCheckout.html#loadPayPalSDK
        let sdkOptions = {
          currency: this.getPaymentIntent().currency_code,
          vault: true,
        };
        let cspNonce = window._hp_csp_nonce || Helpers.getCbInstance().options.cspNonce || '';
        if (cspNonce != null && cspNonce != undefined) {
          sdkOptions['dataAttributes'] = {
            'csp-nonce': cspNonce,
          };
        }
        if (options.locale) {
          sdkOptions['locale'] = options.locale;
        }
        return this.bPaypalCheckoutInstance.loadPayPalSDK(sdkOptions);
      })
      .then((paypalCheckoutInstance) => {
        return new Promise((resolve, reject) => {
          this.paypal()
            .Buttons({
              style: options.style,
              fundingSource: this.paypal().FUNDING.PAYPAL,
              onInit: (data, actions) => {
                resolve(true);
              },
              createBillingAgreement: () => {
                return paypalCheckoutInstance.createPayment({
                  flow: 'vault', // Required
                  enableShippingAddress: true,
                  shippingAddressEditable: true,
                });
              },
              onClick: (data, actions) => this.handleClick(data, actions),
              onApprove: (data, actions) => {
                return paypalCheckoutInstance
                  .tokenizePayment(data)
                  .then((payload) => {
                    this.approvedPayload = payload;
                    return this.initPayment();
                  })
                  .then((fc) => this.confirmPayment(fc));
              },
              onCancel: (data) => {
                this.callbackHandler.triggerCancelCallback(data);
              },
              onError: (err) => {
                if (
                  (err.name && err.name == 'Error' && err.message && err.message.includes('Window is closed')) ||
                  (err.name && err.name == 'Cancel')
                ) {
                  this.callbackHandler.triggerCancelCallback(err.message);
                } else {
                  this.callbackHandler.triggerErrorCallback(err);
                }
              },
            })
            .render(id);
        });
      });
  }

  protected handlePaymentAttemptStatus(paymentAttemptStatus: PaymentAttemptStatus) {
    switch (paymentAttemptStatus) {
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

  private generateBraintreeClientToken(): Promise<any> {
    const paymentIntentId = this.getPaymentIntent().id;
    const referenceId = this.getPaymentIntent().reference_id;
    const payload: any = {
      paymentIntentId,
    };

    if (referenceId) payload.referenceId = referenceId;

    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.GenerateBraintreeClientToken,
          data: payload,
        },
        Ids.MASTER_FRAME,
        {timeout: 10000}
      )
    );
  }

  private createBraintreeClientInstance(token: string): Promise<any> {
    // if (this..options && this.parent.options.braintree) {
    //   return Promise.resolve(this.parent.options.braintree);
    // }
    return this.braintree().client.create({
      authorization: token,
    });
  }

  private createBraintreePaypalInstance(): Promise<any> {
    return this.braintree().paypalCheckout.create({
      client: this.bInstance,
    });
  }

  private braintree() {
    return window['braintree'];
  }

  private loadBraintreeJS(): Promise<any> {
    if (!this.braintree()) {
      return loadScript('https://js.braintreegateway.com/web/3.96.1/js/client.min.js', 'braintree').then(() => {
        return loadScriptUsingPredicate(
          'https://js.braintreegateway.com/web/3.96.1/js/paypal-checkout.min.js',
          () => !!this.braintree().paypalCheckout
        );
      });
    }
    if (this.braintree() && !this.braintree().paypalCheckout) {
      return loadScriptUsingPredicate(
        `https://js.braintreegateway.com/web/${this.braintree().client.VERSION}/js/paypal-checkout.min.js`,
        () => !!this.braintree().paypalCheckout
      );
    }
    return Promise.resolve(true);
  }

  private getPayerInfo() {
    let out: any = {};
    const pp = this.approvedPayload && this.approvedPayload.details;
    if (!pp) {
      return out;
    }
    out.customer = {
      firstName: pp.firstName,
      lastName: pp.lastName,
      email: pp.email,
    };
    if (pp.billingAddress) {
      out.billing_address = {
        firstName: pp.firstName,
        lastName: pp.lastName,
        phone: pp.phone,
        addressLine1: pp.billingAddress.line1,
        addressLine2: pp.billingAddress.line2,
        zip: pp.billingAddress.postalCode,
        stateCode: pp.billingAddress.state,
        city: pp.billingAddress.city,
        countryCode: pp.billingAddress.countryCode,
      };

      /* Add state/stateCode based on length of state's value */
      if (pp.billingAddress.state) {
        if (pp.billingAddress.state.length > 2) out.billing_address.state = pp.billingAddress.state;
        else out.billing_address.stateCode = pp.billingAddress.state;
      }
    }
    if (pp.shippingAddress) {
      out.shipping_address = {
        firstName: pp.shippingAddress.recipientName,
        addressLine1: pp.shippingAddress.line1,
        addressLine2: pp.shippingAddress.line2,
        zip: pp.shippingAddress.postalCode,
        city: pp.shippingAddress.city,
        countryCode: pp.shippingAddress.countryCode,
        phone: pp.shippingAddress.phone,
      };

      /* Add state/stateCode based on length of state's value */
      if (pp.shippingAddress.state) {
        if (pp.shippingAddress.state.length > 2) out.shipping_address.state = pp.shippingAddress.state;
        else out.shipping_address.stateCode = pp.shippingAddress.state;
      }

      let names = pp.shippingAddress.recipientName && pp.shippingAddress.recipientName.split(' ');
      if (names && names.length > 1) {
        out.shipping_address.firstName = names[0];
        out.shipping_address.lastName = names[1];
      }
    }
    return out;
  }
}
