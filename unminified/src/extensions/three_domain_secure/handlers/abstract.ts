import {
  PaymentIntent,
  Callbacks,
  PaymentInfo,
  PaymentAttempt,
  PaymentIntentResponse,
  Customer,
  Mandate,
  ConfirmApiInputPayload,
  TokenizeCardDataInputPayload,
} from '@/extensions/three_domain_secure/common/types';
import ThreeDSecureHandler from '@/extensions/three_domain_secure/index';
import {Master as M} from '@/hosted_fields/common/enums';
import Helpers from '@/helpers/index';
import {CbError as ClientError} from '@/hosted_fields/common/errors';
import LightBox from '@/extensions/three_domain_secure/common/lightbox';
import sanitizeError from '@/extensions/three_domain_secure/common/error-sanitizer';
import {sanitizeAddress, sanitizeCustomerInfo} from '@/extensions/three_domain_secure/common/utils';
import {jsonify, safeGet, isObjectEmpty} from '@/utils/utility-functions';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import Ids from '@/constants/ids';
import {Address} from '@/plugins/three_domain_secure/types';
import {constructPaymentIntentApiPayload} from '@/internal/common/utils';
import {ThreeDSPollingTimeouts} from '@/constants/enums';

export default abstract class AbstractThreeDSecureHandler {
  protected parent: ThreeDSecureHandler;
  protected paymentInfo: PaymentInfo;
  protected callbacks: Callbacks;
  protected iframeContainer: HTMLDivElement;
  protected lightbox: LightBox;
  private resolver: (PaymentIntent) => void;
  private reject: (Error) => void;
  private currentHistoryCount = 0;
  private startTime: number;
  private endTime: number;
  private reattempt: Boolean = false;
  constructor(parent: ThreeDSecureHandler) {
    this.parent = parent;
  }

  public static retrievePaymentIntent(paymentIntentId: string): Promise<PaymentIntent> {
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.RetrievePaymentIntent,
          data: {
            paymentIntentId,
          },
        },
        Ids.MASTER_FRAME,
        {timeout: 10000}
      )
    ) as Promise<PaymentIntent>;
  }

  protected hasAdditionalData(): boolean {
    return !!(this.paymentInfo && this.paymentInfo.additionalData);
  }

  private setBillingAddress(paymentInfo: PaymentInfo) {
    const data = paymentInfo.additionalData;
    if (data.billingAddress || data.cardBillingAddress) {
      const addr = sanitizeAddress(data.billingAddress || data.cardBillingAddress);
      paymentInfo.additionalData.cardBillingAddress = addr;
      // Deprecated card billing address property
      paymentInfo.additionalData.billingAddress = addr;
    }
    if (data.customerBillingAddress)
      paymentInfo.additionalData.customerBillingAddress = sanitizeAddress(data.customerBillingAddress);
    if (data.shippingAddress) {
      paymentInfo.additionalData.shippingAddress = sanitizeAddress(data.shippingAddress);
    }
  }

  private setCustomerInfo(paymentInfo: PaymentInfo) {
    const additionalData = paymentInfo.additionalData;
    const billingInfo = additionalData.customerBillingAddress || {};
    if (!additionalData.customer) additionalData.customer = {};
    if (additionalData.customer) {
      const customer = additionalData.customer;
      customer.email = customer.email || additionalData.email;
      customer.phone = customer.phone || additionalData.phone || billingInfo.phone;
    }
    additionalData.customer = sanitizeCustomerInfo(additionalData.customer);
  }

  handleCardPayment(paymentInfo: PaymentInfo, callbacks: Callbacks = {}): Promise<PaymentIntent> {
    this.startTime = new Date().getTime();
    if (this.parent.isCbCheckout && window.history.state) {
      window.history.pushState(window.history.state, 'cb-checkout');
      this.currentHistoryCount = window.history.length;
    }
    return new Promise<PaymentIntent>((resolve, reject) => {
      this.resolver = resolve;
      this.reject = reject;
      this.paymentInfo = paymentInfo;
      try {
        if (this.hasAdditionalData()) {
          this.setBillingAddress(paymentInfo);
          this.setCustomerInfo(paymentInfo);
        }
        this.callbacks = this.sanitizeCallbacks(callbacks);
        this.reattempt = true;
        this.validate();
        this.handlePayment();
      } catch (error) {
        this.callError(error);
      }
    });
  }

  private sanitizeCallbacks(userCallbacks: Callbacks): Callbacks {
    const allowedCallbacks = ['success', 'error', 'change', 'challenge', 'cancel'];

    allowedCallbacks.forEach((prop) => {
      const callback = userCallbacks[prop];
      if (callback && typeof callback !== 'function') {
        console.warn(`Invalid ${prop} callback specified`);
        delete userCallbacks[prop];
      }
    });

    return userCallbacks;
  }

  abstract validate(): boolean;

  abstract handlePayment(): void;

  public cancel(reason?: string): Promise<any> {
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.CancelPaymentIntent,
          data: {
            paymentIntentId: this.getPaymentIntent().id,
            reason,
          },
        },
        Ids.MASTER_FRAME
      )
    );
  }

  protected abstract handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any>;

  protected createIframe() {
    const gateway: string = this.getPaymentIntent().gateway;
    this.lightbox = new LightBox(gateway);

    this.lightbox.createIframe(`cb-3ds-iframe-${Helpers.genUuid()}`);
    return this.lightbox.getIframe();
  }

  protected openIframe() {
    this.lightbox && this.lightbox.open();
  }

  protected hideIframeLoader() {
    this.lightbox && this.lightbox.hideLoader();
  }

  protected removeIframe() {
    if (this.lightbox) {
      this.lightbox.close();
      this.lightbox.destroy();
    }
  }

  protected createHiddenIframe(name: string) {
    const iframe = document.createElement('iframe');
    iframe.id = `cb-hidden-frame-${Helpers.genUuid()}`;
    iframe.name = name;
    iframe.style.display = 'none';
    iframe.style.height = '1px';
    iframe.style.width = '1px';
    return iframe;
  }

  // Success callback
  protected callSuccess() {
    this.endTime = new Date().getTime();
    this.kvl({
      action: 'threeds_time_taken',
      threeds_start_time: this.startTime,
      threeds_end_time: this.endTime,
      threeds_time_taken: this.endTime - this.startTime,
      resp_status: 'success',
    });
    const intent = this.getPaymentIntent();
    if (this.callbacks && this.callbacks.success) {
      this.callbacks.success(intent);
    }
    this.resolver(intent);
    if (this.parent.isCbCheckout && window.history.state) {
      window.history.go(this.currentHistoryCount - window.history.length - 1);
    }
  }

  protected intentError(): ClientError {
    const intent = this.getPaymentIntent();
    const attempt = intent.active_payment_attempt;

    if (attempt.error_code || attempt.error_text || attempt.error_msg) {
      let message = attempt.error_text || attempt.error_msg || '';
      message = message.split('request-id')[0].trim();
      return new ClientError({
        name: `PAYMENT_ATTEMPT_${attempt.status.toUpperCase()}`,
        code: attempt.error_code,
        message,
        payment_intent: intent,
      });
    }
  }

  // Error callback
  protected callError(error) {
    this.endTime = new Date().getTime();
    this.kvl(error);
    this.kvl({
      action: 'threeds_time_taken',
      threeds_start_time: this.startTime,
      threeds_end_time: this.endTime,
      threeds_time_taken: this.endTime - this.startTime,
      resp_status: 'error',
    });
    let sError = sanitizeError(error, safeGet(this.paymentInfo, 'additionalData.locale'));
    const intent = this.getPaymentIntent();
    if (this.callbacks && this.callbacks.error) {
      this.callbacks.error(intent, sError);
    }
    if (sError instanceof ClientError) error = jsonify(sError);
    this.logError(sError);
    this.reject(sError);
    if (this.parent.isCbCheckout && window.history.state) {
      window.history.go(this.currentHistoryCount - window.history.length - 1);
    }
  }

  // Change callback
  protected callChange() {
    const intent = this.getPaymentIntent();
    const attempt = this.getPaymentAttempt();
    if (this.callbacks && this.callbacks.change) {
      this.callbacks.change(intent, attempt.status);
    }
  }

  // Cancel callback
  protected callCancel(): Promise<void> {
    if (this.callbacks && this.callbacks.cancel) {
      return Promise.resolve(this.callbacks.cancel());
    }
    return Promise.resolve();
  }

  protected confirmPayment(data: ConfirmApiInputPayload = {}): Promise<any> {
    if (this.reattempt) {
      Object.assign(data, {reattempt: this.reattempt});
      this.reattempt = false;
    }
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.ConfirmPaymentIntent,
          data: constructPaymentIntentApiPayload(this.getPaymentIntent(), data),
        },
        Ids.MASTER_FRAME,
        {timeout: 120000}
      )
    ).then((intentResponse: PaymentIntentResponse) => {
      // Attach additional data to payment attempt
      intentResponse.payment_intent.active_payment_attempt.action_payload =
        intentResponse.action_payload || intentResponse.payment_intent.active_payment_attempt.action_payload;

      this.setPaymentIntent(intentResponse.payment_intent);
      return this.handlePaymentAttempt(this.getPaymentAttempt());
    });
  }

  protected tokenizePaymentComponentCard(data: TokenizeCardDataInputPayload = {}): Promise<any> {
    if (this.reattempt) {
      Object.assign(data, {reattempt: this.reattempt});
      this.reattempt = false;
    }
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.tokenizePaymentComponentCard,
          data: constructPaymentIntentApiPayload(this.getPaymentIntent(), data),
        },
        Ids.MASTER_FRAME,
        {timeout: 120000}
      )
    );
  }

  protected fetchGatewayCredential(): Promise<any> {
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.FetchGatewayCredential,
          data: {...constructPaymentIntentApiPayload(this.getPaymentIntent()), origin: window.location.origin},
        },
        Ids.MASTER_FRAME,
        {timeout: 10000}
      )
    );
  }

  protected fetchGatewayToken(data): Promise<any> {
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.FetchGatewayToken,
          data,
        },
        Ids.MASTER_FRAME,
        {timeout: 10000}
      )
    );
  }

  protected getPaymentIntent(): PaymentIntent {
    return this.parent.paymentIntent;
  }

  protected getReferenceId(): string {
    return this.getPaymentIntent().reference_id;
  }

  protected setPaymentIntent(paymentIntent: PaymentIntent) {
    this.parent.paymentIntent = paymentIntent;
  }

  protected getPaymentAttempt(): PaymentAttempt {
    return this.getPaymentIntent().active_payment_attempt;
  }

  private givenPaymentInfo(): string {
    return this.paymentInfo.element
      ? 'element'
      : this.paymentInfo.tokenizer
      ? 'tokenizer'
      : this.paymentInfo.card
      ? 'card'
      : this.getPaymentIntent().reference_id
      ? 'reference_id'
      : this.paymentInfo.cbToken
      ? 'cb_token'
      : this.paymentInfo.paymentComponent
      ? 'payment_component'
      : 'none';
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

  protected getCustomerInfo(): Customer {
    if (this.hasAdditionalData()) {
      const additionalData = this.paymentInfo.additionalData;
      if (!isObjectEmpty(additionalData.customer)) {
        return additionalData.customer;
      } else if (additionalData.email || additionalData.phone) {
        // To support legacy params email, phone
        return {email: additionalData.email, phone: additionalData.phone};
      }
    }
  }

  protected getMandateInfo(): Mandate {
    if (this.hasAdditionalData()) {
      const additionalData = this.paymentInfo.additionalData;
      if (!isObjectEmpty(additionalData.mandate)) {
        return additionalData.mandate;
      }
    }
  }

  protected getMetadata(): any {
    let threeDSInfo = {};
    const intent = this.getPaymentIntent();
    const attempt = this.getPaymentAttempt();

    if (intent) {
      Object.assign(threeDSInfo, {
        paymentIntent: {
          id: intent.id,
          status: intent.status,
          gatewayName: intent.gateway,
          gatewayAccountId: intent.gateway_account_id,
          paymentMethodType: intent.payment_method_type,
        },
      });
    }

    if (attempt) {
      Object.assign(threeDSInfo, {
        paymentAttempt: {
          id: attempt.id,
          status: attempt.status,
          actionPayloadPresent: !!attempt.action_payload,
        },
      });
    }

    if (this.paymentInfo) {
      Object.assign(threeDSInfo, {
        paymentInput: {
          type: this.givenPaymentInfo(),
          additionalDataPresent: !!this.paymentInfo.additionalData,
        },
      });
    }

    const data = {
      site_meta: Helpers.getSiteMetaData(),
      three_ds_meta: threeDSInfo,
    };

    return data;
  }

  protected getAdditionalMetaData(): {} {
    if (this.hasAdditionalData()) {
      const additionalData = this.paymentInfo.additionalData;
      if (!isObjectEmpty(additionalData.metaData)) {
        return additionalData.metaData;
      }
    }
  }

  protected kvl(data): Promise<any> {
    const payload = {
      ...jsonify(data),
      ...this.getMetadata(),
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

  protected logError(error, extraData = {}): Promise<any> {
    const {site_meta, three_ds_meta} = this.getMetadata();
    Object.assign(extraData, {site_meta, three_ds_meta});

    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.CaptureException,
          data: {
            error: jsonify(error),
            extraData,
          },
        },
        Ids.MASTER_FRAME
      )
    );
  }

  protected pollFor3DSCompletion() {
    const paymentIntentId = this.getPaymentIntent().id;
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.PollPaymentIntent3DSResult,
          data: {paymentIntentId},
        },
        Ids.MASTER_FRAME,
        {timeout: ThreeDSPollingTimeouts.DEFAULT}
      )
    );
  }

  protected pollFor3DSCompletionForPendingAuthorization() {
    const paymentIntentId = this.getPaymentIntent().id;
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.PollPaymentIntentResultBeforeRequiresChallenge,
          data: {paymentIntentId},
        },
        Ids.MASTER_FRAME,
        {timeout: ThreeDSPollingTimeouts.DEFAULT}
      )
    );
  }

  public setChallengeWindowSize(containerEl, challengeWindowSize) {
    const threeDSConfiguration = {
      '01': ['250px', '400px'],
      '02': ['390px', '400px'],
      '03': ['500px', '600px'],
      '04': ['600px', '400px'],
      '05': ['100%', '100%'],
    };
    const windowConfig = threeDSConfiguration[challengeWindowSize];
    if (windowConfig) {
      containerEl.setAttribute('style', `width:${windowConfig[0]} !important; height:${windowConfig[1]} !important`);
    }
  }
}
