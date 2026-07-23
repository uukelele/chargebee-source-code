import VenmoHandler from '@/plugins/payments/venmo/handlers/index';
import {Callbacks, PaymentAttemptStatus, PaymentIntent, PaymentMethodType} from '@/internal/payment-intent/types';
import {loadScriptUsingPredicate} from '@/internal/common/utils';
import {Options} from '@/plugins/payments/venmo/types';
import qs from 'qs';
import errors from '@/hosted_fields/common/errors';

export default class PaypalVenmoHandler extends VenmoHandler {
  constructor(handler: VenmoHandler, ...args) {
    super(...args);
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.VENMO,
    });
  }

  mountPaymentButton(id: string, options: Options): Promise<any> {
    return this.fetchGatewayCredential().then((response) => {
      if (response && response.client_id && response.merchant_id) {
        return this.renderVenmoButton(id, options, response.client_id, response.merchant_id);
      } else {
      }
    });
  }

  renderVenmoButton(id: string, options: Options, clientID: string, merchantID: string) {
    return this.loadPaypalSdk(clientID, merchantID, options).then(() => {
      let venmoButtonContainer = document.getElementById(id);
      let venmoButtonElement = document.createElement('div');
      venmoButtonContainer.appendChild(venmoButtonElement);

      let paypalButtons = this.paypal().Buttons({
        fundingSource: this.paypal().FUNDING.VENMO,
        style: options.style,
        createOrder: async (data, actions) => {
          try {
            return this.initPayment().then((data) => {
              return this.confirmPayment(data).then((response) => {
                return response.active_payment_attempt.id_at_gateway;
              });
            });
          } catch (error) {
            this.callbackHandler.triggerErrorCallback(error);
          }
        },
        onApprove: async (data, actions) => {
          try {
            return this.confirmPayment();
          } catch (error) {
            this.callbackHandler.triggerErrorCallback(error);
          }
        },
        onCancel: (data, actions) => {
          this.callbackHandler.triggerErrorCallback(errors.venmoAppCanceled);
        },
        onError: (err) => {
          this.callbackHandler.triggerErrorCallback(err);
        },
      });
      return paypalButtons.render(venmoButtonElement);
    });
  }

  handlePayment(callbacks: Callbacks): Promise<PaymentIntent> {
    this.initCallbacks({}, callbacks);
    return new Promise<PaymentIntent>((resolve, reject) => {
      this.callbackHandler.setPromiseResolvers(resolve, reject);
    });
  }

  private paypal() {
    const paypal_namespace = 'paypal_' + this.getPaymentIntent().gateway_account_id;
    return window[paypal_namespace];
  }

  loadPaypalSdk(clientID: string, merchantID: string, options: Options): Promise<any> {
    const {allowed, disallowed} = options.funding || {};
    const queryString = qs.stringify({
      'client-id': clientID,
      'merchant-id': merchantID,
      'buyer-country': 'US',
      intent: 'authorize',
      currency: this.getPaymentIntent().currency_code,
      ...(disallowed && disallowed.length > 0 ? {'disable-funding': disallowed.join()} : {}),
      ...(allowed && allowed.length > 0 ? {'enable-funding': allowed.join()} : {}),
      ...(options.locale ? {locale: options.locale} : {}),
    });

    if (!(this.paypal() && this.paypal().Buttons)) {
      return loadScriptUsingPredicate(
        `https://www.paypal.com/sdk/js?${queryString}`,
        () => !!(this.paypal() && this.paypal().Buttons),
        'paypal_' + this.getPaymentIntent().gateway_account_id
      );
    }
    return Promise.resolve(true);
  }

  protected handlePaymentAttemptStatus(paymentAttemptStatus: PaymentAttemptStatus) {
    switch (paymentAttemptStatus) {
      case PaymentAttemptStatus.AUTHORIZED:
        this.callbackHandler.triggerSuccessCallback();
        return Promise.resolve(this.getPaymentIntent());
      case PaymentAttemptStatus.REFUSED:
        this.callbackHandler.triggerErrorCallback(this.callbackHandler.intentError());
        return Promise.reject(this.callbackHandler.intentError());
      case PaymentAttemptStatus.REQUIRES_CHALLENGE:
        return Promise.resolve(this.getPaymentIntent());
    }
    return this.handlePaymentAttempt(this.getPaymentAttempt());
  }
}
