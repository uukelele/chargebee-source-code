import VenmoHandler from '@/plugins/payments/venmo/handlers/index';
import {Callbacks, PaymentAttemptStatus, PaymentIntent, PaymentMethodType} from '@/internal/payment-intent/types';
import {loadScript, loadScriptUsingPredicate} from '@/internal/common/utils';
import {Options} from '@/plugins/payments/venmo/types';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import {Master as M} from '@/hosted_fields/common/enums';
import Ids from '@/constants/ids';
import VenmoHandlerUtil from '@/plugins/payments/venmo/handlers/utils';
import errors from '@/hosted_fields/common/errors';

export default class BraintreeVenmoHandler extends VenmoHandler {
  private approvedPayload: any;
  private allowVenmoSandboxEnv = false;
  private allowSendingAddressDetails = false;

  constructor(handler: VenmoHandler, ...args) {
    super(...args);
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.VENMO,
      tmpToken: this.approvedPayload.nonce,
    });
  }

  mountPaymentButton(id: string, options: Options): Promise<any> {
    return Promise.all([this.generateBraintreeClientToken(), this.loadBraintreeJS()])
      .then(([response]) => {
        this.allowVenmoSandboxEnv = response.braintree_venmo_sandbox_env;
        this.allowSendingAddressDetails = response.braintree_venmo_enable_address;
        return this.createBraintreeClientInstance(response.client_token);
      })
      .then((clientInstance) => {
        return this.createVenmoAndDataCollectorInstance(clientInstance);
      })
      .then((results) => {
        return this.createVenmoButton(results, id);
      });
  }

  private createVenmoAndDataCollectorInstance(clientInstance) {
    return Promise.all([
      this.braintree().dataCollector.create({
        client: clientInstance,
        paypal: true,
      }),
      this.braintree().venmo.create({
        allowDesktopWebLogin: true,
        mobileWebFallBack: true,
        client: clientInstance,
        allowDesktop: true,
        paymentMethodUsage: 'multi_use',
        ...(this.allowSendingAddressDetails && {
          collectCustomerBillingAddress: true,
          collectCustomerShippingAddress: true,
        }),
      }),
    ]);
  }

  createVenmoButton(results, id) {
    let venmoInstance = results[1];
    if (!venmoInstance.isBrowserSupported()) {
      this.callbackHandler.triggerErrorCallback(errors.venmoNotSupportedByBrowser);
      return;
    }
    let x = new VenmoHandlerUtil().createVenmoButton();
    let venmoButton = document.getElementById(id).appendChild(x);
    this.displayVenmoButton(venmoInstance, venmoButton);
    if (venmoInstance.hasTokenizationResult()) {
      venmoInstance
        .tokenize()
        .then((payload) => {
          this.handleVenmoSuccess(payload);
        })
        .catch((err) => {
          this.handleVenmoError(err);
        });
    }
  }
  handlePayment(callbacks: Callbacks): Promise<PaymentIntent> {
    this.initCallbacks({}, callbacks);
    return new Promise<PaymentIntent>((resolve, reject) => {
      this.callbackHandler.setPromiseResolvers(resolve, reject);
    });
  }

  private braintree() {
    return window['braintree'];
  }

  createBraintreeClientInstance(token: string): Promise<any> {
    return this.braintree().client.create({
      authorization: token,
    });
  }

  loadBraintreeJS(): Promise<any> {
    if (!this.braintree()) {
      return loadScript('https://js.braintreegateway.com/web/3.96.1/js/client.min.js', 'braintree')
        .then(() => {
          return loadScriptUsingPredicate(
            'https://js.braintreegateway.com/web/3.96.1/js/venmo.min.js',
            () => !!this.braintree().venmo
          );
        })
        .then(() => {
          return loadScriptUsingPredicate(
            'https://js.braintreegateway.com/web/3.96.1/js/data-collector.min.js',
            () => !!this.braintree().dataCollector
          );
        });
    }
    let promises = [];
    if (this.braintree() && !this.braintree().venmo) {
      promises.push(
        loadScriptUsingPredicate(
          `https://js.braintreegateway.com/web/${this.braintree().client.VERSION}/js/venmo.min.js`,
          () => !!this.braintree().venmo
        )
      );
    }
    if (this.braintree() && !this.braintree().dataCollector) {
      promises.push(
        loadScriptUsingPredicate(
          `https://js.braintreegateway.com/web/${this.braintree().client.VERSION}/js/data-collector.min.js`,
          () => !!this.braintree().dataCollector
        )
      );
    }
    return Promise.all(promises);
  }
  generateBraintreeClientToken(): Promise<any> {
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

  displayVenmoButton(venmoInstance, venmoButton) {
    // Assumes that venmoButton is initially display: none.
    venmoButton.style.display = 'block';

    venmoButton.addEventListener('click', (payload) => {
      // for testing purpose we can use braintree test nonce to complete payment
      // set gw_venmo_checkout_test_nonce to true in env_prop
      this.callbackHandler.triggerClickCallback();

      if (this.allowVenmoSandboxEnv) {
        // Creating sample JSON payload
        this.approvedPayload = {
          details: {
            payerInfo: {
              billingAddress: {
                phoneNumber: '5555551234',
                addressLine1: '132 My Street',
                addressLine2: 'Kingston',
                addressLine3: '',
                adminArea2: 'New York',
                adminArea1: 'NY',
                countryCode: 'US',
                postalCode: '12401',
              },
              firstName: 'John',
              lastName: 'Doe',
              email: 'sidd@gmail.com',
              phoneNumber: '5555551234',
            },
          },
        };
        this.confirmPayment({
          paymentMethodType: 'venmo',
          paymentMethodDetails: {
            tempToken: 'fake-venmo-account-nonce',
          },
        });
      } else {
        venmoInstance
          .tokenize()
          .then((payload) => {
            this.handleVenmoSuccess(payload);
          })
          .catch((err) => {
            this.handleVenmoError(err);
          })
          .then(function () {
            venmoButton.removeAttribute('disabled');
          });
      }
    });
  }

  getPayerInfo() {
    let out: any = {};

    const payload = this.approvedPayload || {};
    const details = payload.details || {};
    const payerInfo = details.payerInfo || {};
    const billingAddress = payerInfo.billingAddress || {};
    const shippingAddress = payerInfo.shippingAddress || {};

    out.billingAddress = {
      phone: billingAddress.phoneNumber,
      addressLine1: billingAddress.addressLine1,
      addressLine2: billingAddress.addressLine2,
      city: billingAddress.adminArea2,
      stateCode: billingAddress.adminArea1,
      countryCode: billingAddress.countryCode,
      zip: billingAddress.postalCode,
    };

    out.shipping_address = {
      phone: shippingAddress.phoneNumber,
      addressLine1: shippingAddress.addressLine1,
      addressLine2: shippingAddress.addressLine2,
      city: shippingAddress.adminArea2,
      stateCode: shippingAddress.adminArea1,
      countryCode: shippingAddress.countryCode,
      zip: shippingAddress.postalCode,
    };

    out.customer = {
      firstName: payerInfo.firstName,
      lastName: payerInfo.lastName,
      email: payerInfo.email,
      phone: payerInfo.phoneNumber,
    };

    const userNameFromIntent = this.getPaymentIntent().payer_info || {};
    out.userName = userNameFromIntent.userName;

    return out;
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

  handleVenmoError(err) {
    if (err.code === 'VENMO_CANCELED') {
      this.callbackHandler.triggerErrorCallback(errors.venmoCanceled);
    } else if (err.code === 'VENMO_APP_CANCELED') {
      this.callbackHandler.triggerErrorCallback(errors.venmoAppCanceled);
    } else if (err.code === 'FRAME_SERVICE_FRAME_CLOSED') {
      this.callbackHandler.triggerCancelCallback();
    } else {
      this.callbackHandler.triggerErrorCallback(err);
    }
  }

  handleVenmoSuccess(payload) {
    this.approvedPayload = payload;

    this.confirmPayment({
      paymentMethodType: 'venmo',
      paymentMethodDetails: {
        tempToken: payload.nonce,
      },
    });
  }
}
