import {
  PaymentAttemptStatus,
  PaymentAttempt,
  Callbacks,
  PaymentIntent,
  PaymentMethodType,
} from '@/internal/payment-intent/types';
import PaypalHandler from '@/plugins/payments/paypal_express_checkout/handlers';
import {Funding, Options} from '../types';
import Helpers from '@/helpers';
import Errors from '@/hosted_fields/common/errors';
import {loadScriptUsingPredicate} from '@/extensions/three_domain_secure/common/utils';
import qs from 'qs';

const Interval = 2000;
const MaxRetries = 2;

export default class PaypalExpressCheckoutHandler extends PaypalHandler {
  private pendingVaultSetupTokenId: string | null = null;

  constructor(handler: PaypalHandler, ...args) {
    super(...args);
  }

  paypal() {
    const paypal_namespace = 'paypal_' + this.getPaymentIntent().gateway_account_id;
    return window[paypal_namespace];
  }

  handlePayment(callbacks: Callbacks): Promise<PaymentIntent> {
    this.initCallbacks({}, callbacks);
    return new Promise<PaymentIntent>((resolve, reject) => {
      this.callbackHandler.setPromiseResolvers(resolve, reject);
    });
  }

  async mountPaymentButton(id: string, options: Options): Promise<any> {
    const response = await this.fetchGatewayCredential();
    if (response && response.client_id && response.merchant_id) {
      this.kvl({
        action: 'paypal_sdk',
        result: 'true',
        vault_flow_enabled: !!response.vault_flow_enabled,
        payment_intent_id: this.getPaymentIntent().id,
      });
      return this.renderPaypalButton(
        id,
        options,
        response.client_id,
        response.merchant_id,
        !!response.vault_flow_enabled,
        response.user_id_token
      );
    } else {
      return this.renderCheckoutButton(id, options);
    }
  }

  renderCheckoutButton(id: string, options: Options) {
    return Promise.all([this.loadPaypalJS()]).then(() => {
      // To fix Document is ready and element #paypal-button does not exist error
      if (window.document.querySelector(id)) {
        return this.renderButton(id, options);
      } else {
        return new Promise((resolve, reject) => {
          let retryCount = 0;
          const myInterval = setInterval(() => {
            if (document.querySelector(id) || retryCount > MaxRetries) {
              this.kvl({
                action: 'paypal_button_found',
                retry: retryCount,
                result: document.querySelector(id) ? 'true' : 'false',
                payment_intent_id: this.getPaymentIntent().id,
              });
              window.clearInterval(myInterval);
              resolve(this.renderButton(id, options));
            }
            retryCount++;
          }, Interval);
        });
      }
    });
  }

  renderButton(id, options: Options) {
    return this.paypal().Button.render(
      {
        ...this.getConfigurationOptions(options),
        env: Helpers.isTestSite() ? 'sandbox' : 'production',
        payment: () => {
          return this.initPayment().then((data) => this.confirmPayment(data));
        },
        onAuthorize: (data, actions) => {
          return this.confirmPayment();
        },
        onCancel: () => {
          this.cancelPayment('payment cancelled');
        },
        onClick: async () => {
          await this.callbackHandler.triggerClickCallback();
        },
        onError: (err) => {
          this.kvl({
            action: 'paypal_button_exist',
            result: document.querySelector(id) ? 'true' : 'false',
            payment_intent_id: this.getPaymentIntent().id,
          });
          if (
            (err.name && err.name == 'Error' && err.message && err.message.includes('Window is closed')) ||
            (err.name && err.name == 'Cancel')
          ) {
            return this.cancelPayment('payment cancelled');
          } else {
            return this.callbackHandler.triggerErrorCallback(err);
          }
        },
      },
      id
    );
  }

  private isPaypalPopupDismissedError(err: any): boolean {
    const message = (err && typeof err.message === 'string' && err.message) || (typeof err === 'string' ? err : '');
    return message.includes('Detected popup close') || message.includes('Window is closed');
  }

  /**
   * PayPal SDK button callbacks for vault tokenization vs legacy billing agreement.
   * Extracted for unit-test mocking.
   */
  buildVaultCallbacks(vaultFlowEnabled: boolean) {
    if (vaultFlowEnabled) {
      return {
        // createVaultSetupToken is called when the button is clicked; it creates a
        // setup token on the CB backend which the PayPal SDK uses to open the approval popup.
        createVaultSetupToken: (_data, _actions) => {
          this.kvl({
            action: 'paypal_create_vault_setup_token',
            payment_intent_id: this.getPaymentIntent().id,
          });
          return this.createPaypalVaultSetupToken().then((resp: any) => {
            if (!resp || !resp.setup_token_id) {
              throw new Error('Failed to create PayPal vault setup token');
            }
            this.pendingVaultSetupTokenId = resp.setup_token_id;
            return resp.setup_token_id;
          });
        },
      };
    }

    return {
      // Legacy BAID flow.
      createBillingAgreement: (_data, _actions) => {
        return this.initPayment().then((data) => this.confirmPayment(data));
      },
    };
  }

  /**
   * PayPal SDK onApprove handler for vault tokenization vs legacy billing agreement.
   * Extracted for unit-test mocking.
   */
  buildOnApproveHandler(vaultFlowEnabled: boolean) {
    if (vaultFlowEnabled) {
      return (data, _actions) => {
        const vaultSetupToken =
          (data && (data.vaultSetupToken || data.vault_setup_token)) || this.pendingVaultSetupTokenId;
        this.kvl({
          action: 'paypal_on_approve',
          vault_setup_token: vaultSetupToken,
          payment_intent_id: this.getPaymentIntent().id,
        });
        if (!vaultSetupToken) {
          return Promise.reject(new Error('PayPal vault setup token is missing after approval'));
        }
        void this.confirmPayment({
          paymentMethodType: PaymentMethodType.PAYPAL_EXPRESS_CHECKOUT,
          tmpToken: vaultSetupToken,
        });
        return Promise.resolve();
      };
    }

    return (_data, _actions) => {
      this.kvl({
        action: 'paypal_on_approve',
        payment_intent_id: this.getPaymentIntent().id,
      });
      return this.confirmPayment();
    };
  }

  renderPaypalButton(
    id: string,
    options: Options,
    clientID: string,
    merchantID: string,
    vaultFlowEnabled = false,
    userIdToken?: string
  ) {
    return this.loadPaypalSdk(clientID, merchantID, options, vaultFlowEnabled, userIdToken).then(() => {
      this.kvl({
        action: 'paypal_js_loaded',
        payment_intent_id: this.getPaymentIntent().id,
      });

      const vaultCallbacks = this.buildVaultCallbacks(vaultFlowEnabled);
      const onApprove = this.buildOnApproveHandler(vaultFlowEnabled);

      const buttonInstance = this.paypal().Buttons({
        fundingSource: this.paypal().FUNDING.PAYPAL,
        style: options.style,
        ...vaultCallbacks,
        onApprove,
        onCancel: () => {
          this.kvl({
            action: 'paypal_on_cancel',
            payment_intent_id: this.getPaymentIntent().id,
          });
          this.cancelPayment('payment cancelled');
        },
        onClick: (data, actions) => {
          this.kvl({
            action: 'paypal_button_clicked',
            payment_intent_id: this.getPaymentIntent().id,
          });
          return this.handleClick(data, actions);
        },
        onError: (err) => {
          this.kvl({
            action: 'paypal_error',
            result: err && typeof err === 'object' ? JSON.stringify(err) : String(err),
            payment_intent_id: this.getPaymentIntent().id,
          });
          if (
            (err.name && err.name == 'Error' && err.message && err.message.includes('Window is closed')) ||
            (err.name && err.name == 'Cancel')
          ) {
            return this.cancelPayment('payment cancelled');
          }
          if (vaultFlowEnabled && this.isPaypalPopupDismissedError(err)) {
            return;
          }
          return this.callbackHandler.triggerErrorCallback(err);
        },
      });

      this.kvl({
        action: 'paypal_button_created',
        payment_intent_id: this.getPaymentIntent().id,
      });

      // PayPal's `Buttons().render()` returns a ZalgoPromise whose render lifecycle
      // re-checks the DOM asynchronously. If the container disappears between mount
      // and that internal check (e.g. the customer switches payment method), PayPal
      // rejects with "Document is ready and element <selector> does not exist" and
      // ZalgoPromise rethrows the unhandled rejection to the console. Wrap the
      // render result so this specific message is swallowed (with a KVL for
      // telemetry); any other render error continues to propagate.
      const safeRender = () =>
        Promise.resolve(buttonInstance.render(id)).catch((err) => {
          const message =
            (err && typeof err.message === 'string' && err.message) || (typeof err === 'string' ? err : '');
          if (message && message.indexOf('does not exist') !== -1) {
            this.kvl({
              action: 'paypal_button_container_exist',
              result: document.querySelector(id) ? 'true' : 'false',
              payment_intent_id: this.getPaymentIntent().id,
            });
            return;
          }
          throw err;
        });

      // Mirror the retry pattern from renderCheckoutButton: poll for the container
      // up to MaxRetries × Interval ms before invoking PayPal's render(), so we
      // don't hand the SDK a selector that hasn't been mounted yet by the
      // merchant's UI framework.
      if (window.document.querySelector(id)) {
        return safeRender();
      }
      return new Promise((resolve) => {
        let retryCount = 0;
        const myInterval = setInterval(() => {
          if (document.querySelector(id) || retryCount > MaxRetries) {
            this.kvl({
              action: 'paypal_button_found',
              retry: retryCount,
              result: document.querySelector(id) ? 'true' : 'false',
              payment_intent_id: this.getPaymentIntent().id,
            });
            window.clearInterval(myInterval);
            resolve(safeRender());
          }
          retryCount++;
        }, Interval);
      });
    });
  }

  handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_CHALLENGE:
        return Promise.resolve(paymentAttempt.id_at_gateway);
    }
  }

  getConfigurationOptions(options: Options) {
    let customiseOptions = {
      style: options.style,
      funding: this.getPaypalFunding(options),
    };
    if (options.locale) {
      customiseOptions['locale'] = options.locale;
    }
    return customiseOptions;
  }

  getPaypalFunding(options): Funding {
    let funds: string[] = [];
    if (this.paypal() && this.paypal().FUNDING) {
      funds = Object.values(this.paypal().FUNDING).filter((f) => f != this.paypal().FUNDING.PAYPAL) as string[];
    }
    return Object.assign({disallowed: funds}, options.funding);
  }

  loadPaypalSdk(
    clientID: string,
    merchantID: string,
    options: Options,
    vaultFlowEnabled = false,
    userIdToken?: string
  ): Promise<any> {
    const {allowed, disallowed} = options.funding || {};
    const queryString = qs.stringify({
      ...(disallowed ? {'disable-funding': disallowed.join()} : {}),
      ...(allowed ? {'enable-funding': allowed.join()} : {}),
      ...(options.locale ? {locale: options.locale} : {}),
      'client-id': clientID,
      'merchant-id': merchantID,
      currency: this.getPaymentIntent().currency_code,
      ...(vaultFlowEnabled ? {} : {vault: true, intent: 'tokenize'}),
    });
    const sdkUrl = `https://www.paypal.com/sdk/js?${queryString}`;
    const namespace = 'paypal_' + this.getPaymentIntent().gateway_account_id;
    const isSdkLoaded = () => !!(this.paypal() && this.paypal().Buttons);
    if (isSdkLoaded()) {
      return Promise.resolve(true);
    }
    if (vaultFlowEnabled && userIdToken) {
      return this.loadPaypalVaultSdk(sdkUrl, namespace, userIdToken, isSdkLoaded);
    }
    return loadScriptUsingPredicate(sdkUrl, isSdkLoaded, namespace);
  }

  private loadPaypalVaultSdk(
    url: string,
    namespace: string,
    userIdToken: string,
    predicate: () => boolean
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(Errors.scriptLoadError), 50000);
      const onload = () => {
        if (predicate()) {
          clearTimeout(timeout);
          window.setTimeout(() => resolve(true), 100);
        } else {
          window.setTimeout(onload, 100);
        }
      };
      const onerror = () => reject(Errors.scriptLoadError);
      const script = document.createElement('script');
      script.onload = onload;
      script.onerror = onerror;
      let nonce = window._hp_csp_nonce;
      if (Helpers.getCbInstance() && Helpers.getCbInstance().options) {
        nonce = nonce || Helpers.getCbInstance().options.cspNonce;
      }
      if (nonce) {
        script.setAttribute('nonce', nonce);
        script.setAttribute('data-csp-nonce', nonce);
      }
      script.setAttribute('data-namespace', namespace);
      script.setAttribute('data-user-id-token', userIdToken);
      document.head.appendChild(script);
      script.src = url;
    });
  }
}
