import VenmoHandler from '@/plugins/payments/venmo/handlers/index';
import {Callbacks, PaymentAttemptStatus, PaymentIntent, PaymentMethodType} from '@/internal/payment-intent/types';
import {Options} from '@/plugins/payments/venmo/types';
import Helpers from '@/helpers';
import errors, {CbError} from '@/hosted_fields/common/errors';

/** Checkout.com PayPal partner ID on the PayPal SDK script tag (matches server-side HTML builders). */
const CHECKOUT_PAYPAL_PARTNER_ATTRIBUTION_ID = 'CheckoutLtd_PSP';

const Interval = 2000;
const MaxRetries = 2;

const DEFAULT_DISABLE_FUNDING = 'credit,card,sepa';

/** Normalized Venmo approval params (from {@link confirmPayment} `action_payload`). */
export type CheckoutComVenmoApprovalParams = {
  client_id: string;
  merchant_id: string;
  order_id: string;
  currency: string;
  commit: boolean;
  payment_setup_id?: string;
};

export default class CheckoutComVenmoHandler extends VenmoHandler {
  private venmoApprovalParams: CheckoutComVenmoApprovalParams;

  constructor(handler: VenmoHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.VENMO,
    });
  }

  mountPaymentButton(id: string, options: Options): Promise<any> {
    return this.initPayment()
      .then((payload) => this.confirmPayment(payload))
      .then(() => {
        this.venmoApprovalParams = this.parseApprovalParamsFromActionPayload();
        this.assertPayPalApprovalParams();
        return this.loadPaypalSdk(options);
      })
      .then(() => this.renderVenmoButton(id, options));
  }

  renderVenmoButton(id: string, options: Options) {
    const paypalButtons = this.paypal().Buttons({
      fundingSource: this.paypal().FUNDING.VENMO,
      style: options.style,
      createOrder: () => Promise.resolve(this.getPayPalOrderId()),
      onClick: (data, actions) => this.handleClick(data, actions),
      onApprove: (data) =>
        this.confirmPayment({
          additionalInfo: {
            paypalOrderId: data.orderID,
            payerId: data.payerID,
            facilitatorAccessToken: data.facilitatorAccessToken,
            paymentSetupId: this.venmoApprovalParams.payment_setup_id,
          },
        }),
      onCancel: () => {
        this.callbackHandler.triggerErrorCallback(errors.venmoAppCanceled);
      },
      onError: (err) => {
        this.callbackHandler.triggerErrorCallback(err);
      },
    });

    const safeRender = (target: HTMLElement) =>
      Promise.resolve(paypalButtons.render(target)).catch((err) => {
        const message = (err && typeof err.message === 'string' && err.message) || (typeof err === 'string' ? err : '');
        if (message && message.indexOf('does not exist') !== -1) {
          return;
        }
        throw err;
      });

    const mountButton = () => {
      const venmoButtonContainer = document.getElementById(id);
      if (!venmoButtonContainer) {
        return Promise.resolve(undefined);
      }
      const venmoButtonElement = document.createElement('div');
      venmoButtonContainer.appendChild(venmoButtonElement);
      return safeRender(venmoButtonElement);
    };

    if (document.getElementById(id)) {
      return mountButton();
    }

    return new Promise((resolve) => {
      let retryCount = 0;
      const timer = setInterval(() => {
        if (document.getElementById(id) || retryCount > MaxRetries) {
          clearInterval(timer);
          resolve(mountButton());
        }
        retryCount++;
      }, Interval);
    });
  }

  handlePayment(callbacks: Callbacks): Promise<PaymentIntent> {
    this.initCallbacks({}, callbacks);
    return new Promise<PaymentIntent>((resolve, reject) => {
      this.callbackHandler.setPromiseResolvers(resolve, reject);
    });
  }

  async handleClick(data, actions) {
    return new Promise(async (resolve, reject) => {
      try {
        await this.callbackHandler.triggerClickCallback();
        if (actions && actions.resolve) {
          return resolve(actions.resolve());
        }
        resolve(null);
      } catch (err) {
        this.callbackHandler.triggerErrorCallback(err);
        if (actions && actions.reject) {
          return resolve(actions.reject());
        }
        reject(err);
      }
    });
  }

  private paypal() {
    const paypal_namespace = 'paypal_' + this.getPaymentIntent().gateway_account_id;
    return window[paypal_namespace];
  }

  loadPaypalSdk(options: Options): Promise<any> {
    const params = this.venmoApprovalParams;
    const queryParts = [
      `client-id=${encodeURIComponent(params.client_id)}`,
      `merchant-id=${encodeURIComponent(params.merchant_id)}`,
      'buyer-country=US',
      'enable-funding=venmo',
      `disable-funding=${encodeURIComponent(DEFAULT_DISABLE_FUNDING)}`,
      'commit=false',
      `currency=${encodeURIComponent(params.currency || this.getPaymentIntent().currency_code)}`,
    ];
    if (options.locale) {
      queryParts.push(`locale=${encodeURIComponent(options.locale)}`);
    }
    const queryString = queryParts.join('&');

    if (!(this.paypal() && this.paypal().Buttons)) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(errors.scriptLoadError), 50000);
        const onload = () => {
          if (this.paypal() && this.paypal().Buttons) {
            clearTimeout(timeout);
            setTimeout(() => resolve(true), 100);
          } else {
            setTimeout(onload, 100);
          }
        };

        const script = document.createElement('script');
        script.onload = onload;
        script.onerror = () => reject(errors.scriptLoadError);

        let nonce = window._hp_csp_nonce;
        const cbInstance = Helpers.getCbInstance();
        if (cbInstance && cbInstance.options) {
          nonce = nonce || cbInstance.options.cspNonce;
        }
        if (nonce) {
          script.setAttribute('nonce', nonce);
          script.setAttribute('data-csp-nonce', nonce);
        }
        script.setAttribute('data-namespace', 'paypal_' + this.getPaymentIntent().gateway_account_id);
        script.setAttribute('data-partner-attribution-id', CHECKOUT_PAYPAL_PARTNER_ATTRIBUTION_ID);
        script.src = `https://www.paypal.com/sdk/js?${queryString}`;
        document.head.appendChild(script);
      });
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

  private parseApprovalParamsFromActionPayload(): CheckoutComVenmoApprovalParams {
    const attempt = this.getPaymentAttempt();
    const raw = attempt && attempt.action_payload;
    const flat = this.flattenActionPayload(raw);
    const client_id = flat.paypal_client_id || flat.client_id;
    const merchant_id = flat.paypal_merchant_id || flat.merchant_id;
    const order_id = flat.order_id || flat.paypal_order_id;
    const currency = flat.currency || this.getPaymentIntent().currency_code;
    const commitStr = flat.commit != null ? String(flat.commit) : 'false';
    const commit = commitStr === 'true' || commitStr === '1';

    return {
      client_id,
      merchant_id,
      order_id,
      currency,
      commit,
      payment_setup_id: flat.payment_setup_id,
    };
  }

  private flattenActionPayload(raw: any): Record<string, string> {
    if (!raw) {
      return {};
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch (_e) {
        return {};
      }
    }
    if (raw.action && typeof raw.action === 'string') {
      try {
        return JSON.parse(raw.action);
      } catch (_e) {
        return raw;
      }
    }
    return raw;
  }

  private assertPayPalApprovalParams(): void {
    const params = this.venmoApprovalParams;
    if (!params || !params.client_id || !params.merchant_id || !params.order_id) {
      throw new CbError(
        'Missing Checkout.com Venmo fields: need client_id and merchant_id on action_payload, and order_id on action_payload'
      );
    }
  }

  private getPayPalOrderId(): string {
    return this.venmoApprovalParams.order_id;
  }
}
