import {
  PaymentMethodType,
  PaymentAttemptStatus,
  PaymentAttempt,
  Callbacks,
  PaymentIntent,
  PaymentIntentResponse,
} from '@/internal/payment-intent/types';
import PaypalHandler from '@/plugins/payments/paypal_express_checkout/handlers';
import {Options, PaymentInfo} from '../types';
import Helpers from '@/helpers';
import Errors, {CbError} from '@/hosted_fields/common/errors';

/** Checkout.com PayPal partner ID on the PayPal SDK script tag (matches server-side HTML builders). */
const CHECKOUT_PAYPAL_PARTNER_ATTRIBUTION_ID = 'CheckoutLtd_PSP';

const Interval = 2000;
const MaxRetries = 2;

/**
 * Default funding sources to disable — same list as Checkout.com PayPal Payment Setup demo / Java HTML.
 */
const DEFAULT_DISABLE_FUNDING = 'credit,card,sepa,bancontact,blik,eps,giropay,ideal,mercadopago,mybank,p24,sofort';

/** Normalized PayPal approval params (from {@link confirmPayment} `action_payload`). */
export type CheckoutComPayPalApprovalParams = {
  client_id: string;
  merchant_id: string;
  order_id: string;
  currency: string;
  commit: boolean;
  intent: string;
  payment_setup_id?: string;
  disable_funding?: string;
};

/**
 * Checkout.com PayPal: merge {@link confirmPayment} `action_payload` with `fetch_gateway_credential` for SDK params.
 */
export default class CheckoutComPayPalHandler extends PaypalHandler {
  /** Populated after {@link parseApprovalParamsFromActionPayload} and {@link mergePayPalIdsFromGatewayCredential}. */
  private paypalApprovalParams: CheckoutComPayPalApprovalParams;
  private additionalData: PaymentInfo;
  /** Response from {@link fetchGatewayCredential} / `fetch_gateway_credential` API. */
  private gatewayFetchCredential: any;

  constructor(handler: PaypalHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
  }

  /** Namespaced PayPal SDK (`paypal_<gateway_account_id>`). */
  paypal() {
    const windowRef = window as unknown as Record<string, unknown>;
    const legacyNs = 'paypal_' + this.getPaymentIntent().gateway_account_id;
    return (windowRef[this.getPayPalNamespace()] || windowRef[legacyNs]) as {
      Buttons: (config: unknown) => {render: (sel: string) => Promise<void>};
      FUNDING?: {PAYPAL?: string};
    };
  }

  initPayment() {
    const paymentInfo: PaymentInfo = this.getAdditionalData();
    const payload: {
      paymentMethodType: PaymentMethodType;
      paymentMethodDetails?: Record<string, unknown>;
    } = {
      paymentMethodType: PaymentMethodType.PAYPAL_EXPRESS_CHECKOUT,
    };
    if (paymentInfo.customer) {
      payload.paymentMethodDetails = {
        firstName: paymentInfo.customer.firstName,
        lastName: paymentInfo.customer.lastName,
        email: paymentInfo.customer.email,
        phone: paymentInfo.customer.phone,
      };
      if (paymentInfo.customer.billingAddress) {
        payload.paymentMethodDetails.billingAddress = paymentInfo.customer.billingAddress;
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

  /**
   * Checkout.com PayPal Payment Setup:
   * 1) {@link fetchGatewayCredential} — PayPal `client_id` / `merchant_id` (and other gateway pub keys).
   * 2) {@link initPayment} → {@link confirmPayment} — `order_id`, etc. on `action_payload`.
   * 3) Merge; load PayPal SDK; `createOrder` returns `order_id`; `onApprove` → {@link confirmPayment} again.
   */
  mountPaymentButton(id: string, options: Options): Promise<any> {
    this.additionalData = options.additionalData && options.additionalData();
    return Promise.all([
      this.fetchGatewayCredential(),
      this.initPayment().then((payload) => this.confirmPayment(payload)),
    ])
      .then((results) => {
        this.gatewayFetchCredential = results[0];
        this.paypalApprovalParams = this.parseApprovalParamsFromActionPayload();
        this.mergePayPalIdsFromGatewayCredential();
        this.assertPayPalApprovalParams();
        const url = this.buildPayPalSdkUrl(options);
        this.kvl({
          action: 'checkout_com_paypal_sdk',
          payment_intent_id: this.getPaymentIntent().id,
        });
        return this.loadCheckoutComPayPalSdk(url);
      })
      .then(() => this.renderPayPalButtons(id, options));
  }

  /**
   * Prefer `client_id` / `merchant_id` from {@link gatewayFetchCredential} when the API returns them
   * (action_payload from confirm may still supply order_id, currency, commit, etc.).
   */
  private mergePayPalIdsFromGatewayCredential(): void {
    const cred = this.gatewayFetchCredential || {};
    const p = this.paypalApprovalParams;
    if (!p) {
      return;
    }
    const fromCredClient = cred.client_id || cred.paypal_client_id || (cred as Record<string, string>).clientId;
    const fromCredMerchant = cred.merchant_id || cred.paypal_merchant_id || (cred as Record<string, string>).merchantId;
    if (fromCredClient) {
      p.client_id = fromCredClient;
    }
    if (fromCredMerchant) {
      p.merchant_id = fromCredMerchant;
    }
  }

  /**
   * Reads `action_payload` from the current payment attempt after the first confirm (same keys as server HTML builder).
   */
  private parseApprovalParamsFromActionPayload(): CheckoutComPayPalApprovalParams {
    const attempt = this.getPaymentAttempt();
    const raw = attempt && attempt.action_payload;
    const flat = this.flattenActionPayload(raw);
    const client_id = flat.paypal_client_id || flat.client_id;
    const merchant_id = flat.paypal_merchant_id || flat.merchant_id;
    const order_id = flat.order_id;
    const currency = flat.currency || this.getPaymentIntent().currency_code;
    const commitStr = flat.commit != null ? String(flat.commit) : 'true';
    const commit = commitStr === 'true' || commitStr === '1';
    // Default to 'capture' (sale) to match common PayPal order flows. Also
    // normalize legacy 'sale' value to 'capture' so SDK and order API stay
    // consistent when backend omits an explicit intent.
    const rawIntent = flat.intent || flat.paypal_intent || 'capture';
    const intent = rawIntent === 'sale' ? 'capture' : rawIntent;

    return {
      client_id,
      merchant_id,
      order_id,
      currency,
      commit,
      intent,
      payment_setup_id: flat.payment_setup_id,
      disable_funding: flat.disable_funding,
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
    const p = this.paypalApprovalParams;
    if (!p || !p.client_id || !p.merchant_id || !p.order_id) {
      throw new CbError(
        'Missing Checkout.com PayPal fields: need client_id and merchant_id (from fetch_gateway_credential and/or action_payload), and order_id on action_payload'
      );
    }
  }

  private getPayPalOrderId(): string {
    return this.paypalApprovalParams.order_id;
  }

  private getPayPalNamespace(): string {
    const intent = this.paypalApprovalParams && this.paypalApprovalParams.intent;
    return 'paypal_' + this.getPaymentIntent().gateway_account_id + '_checkout_com_' + (intent || 'authorize');
  }

  private buildPayPalSdkUrl(options: Options): string {
    const p = this.paypalApprovalParams;
    const params = new URLSearchParams();
    params.set('client-id', p.client_id);
    params.set('merchant-id', p.merchant_id);
    params.set('disable-funding', p.disable_funding || DEFAULT_DISABLE_FUNDING);
    params.set('commit', String(p.commit));
    params.set('currency', p.currency);
    params.set('intent', p.intent);
    if (options.locale) {
      params.set('locale', options.locale);
    }
    return `https://www.paypal.com/sdk/js?${params.toString()}`;
  }

  private loadCheckoutComPayPalSdk(url: string): Promise<boolean> {
    const namespace = this.getPayPalNamespace();
    const predicate = () => {
      const pp = this.paypal();
      return !!(window as unknown as Record<string, unknown>)[namespace] && !!(pp && pp.Buttons);
    };

    if (predicate()) {
      return Promise.resolve(true);
    }

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

      const script = document.createElement('script');
      script.onload = onload;
      script.onerror = () => reject(Errors.scriptLoadError);

      let nonce = window._hp_csp_nonce;
      const cbInstance = Helpers.getCbInstance();
      if (cbInstance && cbInstance.options) {
        nonce = nonce || cbInstance.options.cspNonce;
      }
      if (nonce) {
        script.setAttribute('nonce', nonce);
        script.setAttribute('data-csp-nonce', nonce);
      }
      script.setAttribute('data-namespace', namespace);
      script.setAttribute('data-partner-attribution-id', CHECKOUT_PAYPAL_PARTNER_ATTRIBUTION_ID);
      script.src = url;
      document.head.appendChild(script);
    });
  }

  private renderPayPalButtons(id: string, options: Options): Promise<unknown> {
    const pp = this.paypal();
    if (!(pp && pp.Buttons)) {
      throw new CbError('PayPal SDK Buttons API unavailable after load');
    }

    this.kvl({
      action: 'checkout_com_paypal_js_loaded',
      payment_intent_id: this.getPaymentIntent().id,
    });

    const fundingSource = pp.FUNDING && pp.FUNDING.PAYPAL !== undefined ? pp.FUNDING.PAYPAL : undefined;

    const buttonInstance = pp.Buttons({
      ...(fundingSource !== undefined ? {fundingSource} : {}),
      style: options.style,
      createOrder: () => Promise.resolve(this.getPayPalOrderId()),
      onClick: (data: unknown, actions: unknown) => {
        this.kvl({
          action: 'checkout_com_paypal_button_clicked',
          payment_intent_id: this.getPaymentIntent().id,
        });
        return this.handleClick(data, actions);
      },
      onApprove: (data: {orderID?: string; facilitatorAccessToken?: string}) => {
        this.kvl({
          action: 'checkout_com_paypal_on_approve',
          payment_intent_id: this.getPaymentIntent().id,
        });
        return this.confirmPayment({
          additionalInfo: {
            paypalOrderId: data.orderID,
            facilitatorAccessToken: data.facilitatorAccessToken,
            paymentSetupId: this.paypalApprovalParams.payment_setup_id,
          },
        });
      },
      onCancel: () => {
        this.kvl({
          action: 'checkout_com_paypal_on_cancel',
          payment_intent_id: this.getPaymentIntent().id,
        });
        return this.cancelPayment('payment cancelled');
      },
      onError: (err: Error & {message?: string; name?: string}) => {
        this.kvl({
          action: 'checkout_com_paypal_error',
          payment_intent_id: this.getPaymentIntent().id,
          result: err && typeof err === 'object' ? JSON.stringify(err) : String(err),
        });
        if (
          (err && err.name === 'Error' && err.message && err.message.indexOf('Window is closed') !== -1) ||
          (err && err.name === 'Cancel')
        ) {
          return this.cancelPayment('payment cancelled');
        }
        if (this.callbackHandler) {
          return this.callbackHandler.triggerErrorCallback(err);
        }
      },
    });

    const safeRender = () =>
      Promise.resolve(buttonInstance.render(id)).catch((err) => {
        const message = (err && typeof err.message === 'string' && err.message) || (typeof err === 'string' ? err : '');
        if (message && message.indexOf('does not exist') !== -1) {
          this.kvl({
            action: 'checkout_com_paypal_button_container_exist',
            result: document.querySelector(id) ? 'true' : 'false',
            payment_intent_id: this.getPaymentIntent().id,
          });
          return;
        }
        throw err;
      });

    if (window.document.querySelector(id)) {
      return safeRender();
    }
    return new Promise((resolve) => {
      let retryCount = 0;
      const myInterval = setInterval(() => {
        if (document.querySelector(id) || retryCount > MaxRetries) {
          this.kvl({
            action: 'checkout_com_paypal_button_found',
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
  }

  /**
   * After the first {@link confirmPayment}, backend may return `REQUIRES_CHALLENGE` with PayPal approval parameters
   * (no redirect). Acknowledge so mounting can proceed.
   */
  handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_CHALLENGE: {
        const raw = paymentAttempt.action_payload;
        if (this.isPayPalApprovalPayload(raw)) {
          return Promise.resolve(true);
        }
        if (raw && raw.redirect_url) {
          return this.handleRedirectChallenge(paymentAttempt);
        }
        return Promise.resolve(true);
      }
      case PaymentAttemptStatus.REQUIRES_REDIRECTION: {
        if (paymentAttempt.action_payload && paymentAttempt.action_payload.redirect_url) {
          return this.handleRedirectChallenge(paymentAttempt);
        }
        return Promise.resolve(true);
      }
      default: {
        return Promise.resolve(true);
      }
    }
  }

  private isPayPalApprovalPayload(raw: any): boolean {
    const flat = this.flattenActionPayload(raw);
    return !!(flat.paypal_client_id || flat.client_id) && !!flat.order_id;
  }

  private handleRedirectChallenge(paymentAttempt: PaymentAttempt): Promise<any> {
    const rawData = paymentAttempt.action_payload;
    if (this.callbackHandler && this.callbackHandler.callbacks && this.callbackHandler.callbacks.challenge) {
      this.callbackHandler.callbacks.challenge(rawData.redirect_url);
      return Promise.resolve(true);
    }
    const iframe = this.createIframe('checkout_com');
    this.openIframe();
    iframe.src = rawData.redirect_url;
    return this.pollForAuthCompletion()
      .then((data: PaymentIntentResponse) =>
        this.confirmPayment({
          additionalInfo: {
            details: data,
            paymentData: rawData.paymentData,
          },
        })
      )
      .finally(() => this.removeIframe());
  }

  getAdditionalData(): PaymentInfo {
    return this.additionalData || {};
  }
}
