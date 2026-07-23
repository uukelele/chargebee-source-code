import {
  PaymentIntent,
  Address,
  Callbacks,
  PaymentInfo,
  PaymentAttempt,
  PaymentIntentResponse,
  PaymentAttemptStatus,
  GatewayInstances,
  Gateway,
  PaymentMethodType,
} from '@/internal/payment-intent/types';
import {Master as M} from '@/hosted_fields/common/enums';
import {sanitizeAddress} from '@/internal/common/utils';
import {isObjectEmpty} from '@/utils/utility-functions';
import {sendToMasterIframe} from '@/hosted_fields/host/iframe-client-loader';
import CallbackHandler from './callback';
import RedirectHandler from '@/internal/auth-redirect/handler';
import Helpers from '@/helpers';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {PaymentOptions} from '@/hosted_fields/common/base-types';
import {PaymentRedirectTimeouts} from '@/constants/enums';
import {constructPaymentIntentApiPayload} from '@/internal/common/utils';
import {ApplePayMountOptions} from '@/plugins/payments/apple_pay/types';

export default class PaymentIntentHandler extends RedirectHandler {
  private paymentIntent: PaymentIntent;
  callbackHandler: CallbackHandler;
  protected gatewayInstances: GatewayInstances;
  protected paymentInfo: PaymentInfo | any;
  protected reattempt: Boolean = false;
  protected callbackTriggered: Boolean = false;
  redirectTimeout: number = PaymentRedirectTimeouts.DEFAULT;
  protected gatewayHandler: PaymentIntentHandler; // This will be used by class which will extend PaymentIntentHandler, like ApplePayhandler

  /**
   * default implementations, to be overridden in the payment/ gateway handler
   */
  initPayment(): Promise<any> {
    return Promise.resolve();
  }

  validate(): Promise<any> {
    return Promise.resolve();
  }

  getPaymentData(): any {
    return {};
  }

  applePayCapabilities(merchantId?: string, options?: ApplePayMountOptions): Promise<any> {
    return Promise.reject(new CbError('INVALID_METHOD_CALLED'));
  }

  isApplePayQRFlowSupported(): boolean {
    return false;
  }

  mount(options: any): Promise<boolean> {
    return Promise.resolve(true);
  }

  fetchUpiInstalledAppList(gatewayCredentials: any): Promise<any> {
    return Promise.reject(new CbError('INVALID_METHOD_CALLED'));
  }

  mountPaymentButton(id: string, options: any): Promise<any> {
    return Promise.reject(new CbError('INVALID_METHOD_CALLED'));
  }

  protected handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    return Promise.reject(new CbError('UNHANDLED_PAYMENT_STATUS'));
  }

  constructor(paymentIntent?: PaymentIntent, gatewayInstances?: GatewayInstances) {
    super();
    this.paymentIntent = paymentIntent;
    this.gatewayInstances = gatewayInstances;
  }

  protected hasAdditionalData(): boolean {
    return !!(this.paymentInfo && this.paymentInfo.additionalData);
  }

  initCallbacks(paymentInfo: PaymentInfo, callbacks: Callbacks = {}) {
    this.callbackHandler = new CallbackHandler(callbacks, {
      paymentIntent: this.paymentIntent,
      paymentInfo,
      // locale, EBE fix this
    });
    this.callbackHandler.setStartTime();

    const isCbCheckout = Helpers.getCbInstance().options.forCbCheckout;
    if (isCbCheckout && window.history.state) {
      window.history.pushState(window.history.state, 'cb-checkout');
      this.callbackHandler.setHistoryCount(window.history.length);
    }
  }

  sanitizeData() {
    if (this.hasAdditionalData()) {
      const data = this.paymentInfo.additionalData;
      if (data.billingAddress || data.cardBillingAddress)
        this.paymentInfo.additionalData.billingAddress = sanitizeAddress(
          data.billingAddress || data.cardBillingAddress
        );
      if (data.customerBillingAddress)
        this.paymentInfo.additionalData.customerBillingAddress = sanitizeAddress(data.customerBillingAddress);
      if (data.shippingAddress) {
        this.paymentInfo.additionalData.shippingAddress = sanitizeAddress(data.shippingAddress);
      }
    }
  }

  getGatewayHandler(paymentIntent?: PaymentIntent, gatewayInstances?: GatewayInstances): Promise<PaymentIntentHandler> {
    let payment = paymentIntent.payment_method_type;
    let gatewayName = paymentIntent.gateway;
    // Card payment intents are not bundled under `@/plugins/payments/card/...`; the
    // gateway-specific card handlers live under `@/extensions/three_domain_secure/handlers/`.
    // Route through that folder to avoid a webpack `Cannot find module './card/handlers/<gateway>'`
    // rejection when an APM dispatcher receives a card-typed payment intent.
    if (payment === PaymentMethodType.CARD) {
      return import(
        /* webpackExclude: /\.test\.ts$/ */
        `@/extensions/three_domain_secure/handlers/${gatewayName}`
      ).then(({default: GatewayHandler}) => new GatewayHandler(this, paymentIntent, gatewayInstances));
    }
    return import(
      /* webpackExclude: /\.test\.ts$/ */
      `@/plugins/payments/${payment}/handlers/${gatewayName}`
    ).then(({default: GatewayHandler}) => new GatewayHandler(this, paymentIntent, gatewayInstances));
  }

  getCommonHandler(
    paymentIntent?: PaymentIntent,
    common?: boolean,
    gatewayInstances?: GatewayInstances
  ): Promise<PaymentIntentHandler> {
    let payment = paymentIntent.payment_method_type;
    let gatewayName = paymentIntent.gateway;
    if (common) {
      return import(
        /* webpackExclude: /\.test\.ts$/ */
        `@/plugins/payments/${payment}/handlers/common`
      ).then(({default: GatewayHandler}) => new GatewayHandler(this, paymentIntent, gatewayInstances));
    }
    // See note in getGatewayHandler — card intents resolve from the three_domain_secure
    // handler tree, not the (non-existent) `@/plugins/payments/card/...` tree.
    if (payment === PaymentMethodType.CARD) {
      return import(
        /* webpackExclude: /\.test\.ts$/ */
        `@/extensions/three_domain_secure/handlers/${gatewayName}`
      ).then(({default: GatewayHandler}) => new GatewayHandler(this, paymentIntent, gatewayInstances));
    }
    return import(
      /* webpackExclude: /\.test\.ts$/ */
      `@/plugins/payments/${payment}/handlers/${gatewayName}`
    ).then(({default: GatewayHandler}) => new GatewayHandler(this, paymentIntent, gatewayInstances));
  }

  getDirectDebitGatewayHandler(
    paymentIntent?: PaymentIntent,
    gatewayInstances?: GatewayInstances
  ): Promise<PaymentIntentHandler> {
    let currency_code = `${paymentIntent.currency_code}`.toUpperCase();
    let gatewayName = paymentIntent.gateway;
    return import(
      /* webpackExclude: /\.test\.ts$/ */
      `@/plugins/payments/direct_debit/handlers/${currency_code}/${gatewayName}`
    )
      .then(({default: GatewayHandler}) => new GatewayHandler(this, paymentIntent, gatewayInstances))
      .catch((error) => {
        return import(
          /* webpackExclude: /\.test\.ts$/ */
          `@/plugins/payments/direct_debit/handlers/common`
        ).then(({default: GatewayHandler}) => new GatewayHandler(this as any, paymentIntent, gatewayInstances));
      });
  }

  /**
   * @param options - type PaymentOptions or any (type ANY to support for bancontact)
   * @returns
   */
  handlePayment(options: PaymentOptions | any): Promise<any> {
    return options
      .paymentIntent()
      .then((paymentIntent) => {
        this.paymentIntent = this.validatePaymentIntent(paymentIntent);
        return this.getGatewayHandler(paymentIntent);
      })
      .then((handler) => {
        handler.setRedirectMode(options.redirectMode);
        return handler.initiateAuthorization(options.paymentInfo, options.callbacks);
      });
  }

  /**
   * @param options - type PaymentInfo or any (type ANY to support for bancontact)
   * @returns
   */
  initiateAuthorization(paymentInfo: PaymentInfo | any, callbacks: Callbacks = {}): Promise<PaymentIntent> {
    this.initCallbacks(paymentInfo, callbacks);

    return new Promise<PaymentIntent>((resolve, reject) => {
      // *** Promise resolution is inside callback handler ***
      this.callbackHandler.setPromiseResolvers(resolve, reject);

      this.paymentInfo = paymentInfo || {};
      try {
        this.sanitizeData();
        this.reattempt = true;
        this.validate()
          .then(() => this.initPayment())
          .then((data) => this.confirmPayment(data))
          .then(() => !this.callbackTriggered && this.callbackHandler.triggerSuccessCallback())
          .catch((error) => {
            if (!this.callbackTriggered) {
              this.callbackHandler.triggerErrorCallback(error instanceof CbError ? error : new CbError(error));
            }
          })
          .finally(() => {
            if (this.isIframeOpen) this.removeIframe();
            this.closeTab();
          });
      } catch (error) {
        this.callbackHandler.triggerErrorCallback(error);
      }
    });
  }

  protected cancelPayment(reason?: string): Promise<any> {
    return sendToMasterIframe(
      M.Actions.CancelPaymentIntent,
      {paymentIntentId: this.paymentIntent.id, reason},
      {timeout: 120000}
    )
      .then((intentResponse: PaymentIntentResponse) => {
        this.setPaymentIntent(intentResponse.payment_intent);
      })
      .finally(() => {
        this.callbackHandler.triggerCancelCallback();
      });
  }

  protected confirmPayment(data: any = {}): Promise<any> {
    if (this.reattempt) {
      Object.assign(data, {reattempt: this.reattempt});
      this.reattempt = false;
    }
    return sendToMasterIframe(
      M.Actions.ConfirmPaymentIntent,
      constructPaymentIntentApiPayload(this.paymentIntent, data),
      {timeout: 120000}
    ).then(this.handleConfirmPaymentResponse);
  }

  protected handleConfirmPaymentResponse = (intentResponse: PaymentIntentResponse) => {
    const {payment_intent: paymentIntent, action_payload, payer_info} = intentResponse;
    const paymentAttempt = paymentIntent.active_payment_attempt;
    this.paymentIntent = paymentIntent;

    // Attach additional data to payment attempt
    paymentIntent.active_payment_attempt.action_payload =
      action_payload || paymentIntent.active_payment_attempt.action_payload;
    if (payer_info) {
      paymentIntent.payer_info = {...payer_info};
    }
    this.setPaymentIntent(paymentIntent);
    const paymentAttemptStatus: PaymentAttemptStatus = paymentAttempt && paymentAttempt.status;

    return this.handlePaymentAttemptStatus(paymentAttemptStatus);
  };

  protected handlePaymentAttemptStatus(paymentAttemptStatus: PaymentAttemptStatus) {
    switch (paymentAttemptStatus) {
      case PaymentAttemptStatus.AUTHORIZED:
        this.callbackTriggered = true;
        this.callbackHandler.triggerSuccessCallback();
        return Promise.resolve(this.paymentIntent);

      case PaymentAttemptStatus.REFUSED:
        this.callbackTriggered = true;
        this.callbackHandler.triggerErrorCallback(this.callbackHandler.intentError());
        return Promise.reject(this.callbackHandler.intentError());
    }

    this.callbackHandler.triggerChangeCallback();
    return this.handlePaymentAttempt(this.getPaymentAttempt());
  }

  // To fetch gateway public credentials
  protected fetchGatewayCredential(): Promise<any> {
    return sendToMasterIframe(M.Actions.FetchGatewayCredential, constructPaymentIntentApiPayload(this.paymentIntent));
  }

  
  protected createPaypalVaultSetupToken(customerId?: string): Promise<any> {
    const payload = constructPaymentIntentApiPayload(this.paymentIntent);
    if (customerId) {
      (payload as any).payload = {customer_id: customerId};
    }
    return sendToMasterIframe(M.Actions.CreatePaypalVaultSetupToken, payload);
  }

  // To fetch gateway payment method configs, similar to pm_list object
  protected fetchGWPaymentMethodConfig(): Promise<any> {
    return sendToMasterIframe(
      M.Actions.FetchGWPaymentMethodConfig,
      constructPaymentIntentApiPayload(this.paymentIntent)
    );
  }

  getPaymentIntent(): PaymentIntent {
    return this.paymentIntent;
  }

  setPaymentIntent(paymentIntent: PaymentIntent) {
    this.paymentIntent = this.validatePaymentIntent(paymentIntent);
    if (this.callbackHandler) this.callbackHandler.setPaymentIntent(paymentIntent);
    if (this.gatewayHandler) this.gatewayHandler.setPaymentIntent(paymentIntent);
  }

  updatePaymentIntent(paymentIntent: PaymentIntent) {
    this.paymentIntent = paymentIntent;
    if (this.callbackHandler) this.callbackHandler.setPaymentIntent(paymentIntent);
    if (this.gatewayHandler) {
      this.gatewayHandler.setPaymentIntent(paymentIntent);
      this.gatewayHandler.updatePaymentIntent(paymentIntent);
    }
  }

  protected getReferenceId(): string {
    return this.paymentIntent.reference_id;
  }

  protected getPaymentAttempt(): PaymentAttempt {
    return this.paymentIntent.active_payment_attempt;
  }

  protected getCardBillingAddress(): Address {
    if (this.hasAdditionalData()) {
      const additionalData = this.paymentInfo.additionalData;
      if (!isObjectEmpty(additionalData.billingAddress)) return additionalData.billingAddress;
      if (!isObjectEmpty(additionalData.cardBillingAddress)) return additionalData.cardBillingAddress;
    }
  }

  protected getCustomerBillingAddress(): Address {
    if (this.hasAdditionalData()) {
      const additionalData = this.paymentInfo.additionalData;
      if (!isObjectEmpty(additionalData.customerBillingAddress)) return additionalData.customerBillingAddress;
    }
  }

  protected getShippingAddress(): Address {
    if (this.hasAdditionalData()) {
      const additionalData = this.paymentInfo.additionalData;
      if (!isObjectEmpty(additionalData.shippingAddress)) return additionalData.shippingAddress;
    }
  }

  protected validatePaymentIntent(intent: PaymentIntent): PaymentIntent {
    if (typeof intent !== 'object' || !(intent.id && intent.amount + '' && intent.status && intent.gateway))
      throw new CbError(Errors.invalidPaymentIntent);
    return intent;
  }

  protected stopPoll(data?: any) {
    const paymentIntentId = this.paymentIntent.id;
    return sendToMasterIframe(
      M.Actions.StopPollPaymentIntent3DSResult,
      {
        paymentIntentId,
        ...data,
      },
      {
        timeout: this.redirectTimeout,
      }
    );
  }

  protected pollForAuthCompletion() {
    const paymentIntentId = this.paymentIntent.id;
    return sendToMasterIframe(
      M.Actions.PollPaymentIntent3DSResult,
      {
        paymentIntentId,
      },
      {
        timeout: this.redirectTimeout,
      }
    ).finally(() => this.closeTab());
  }
}
