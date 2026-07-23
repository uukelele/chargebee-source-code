import {Callbacks, PaymentIntent, PaymentAttempt, PaymentInfo} from '@/internal/payment-intent/types';
import {jsonify} from '@/utils/utility-functions';
import {sendToMasterIframe} from '@/hosted_fields/host/iframe-client-loader';
import {Master as M} from '@/hosted_fields/common/enums';
import {CbError as ClientError} from '@/hosted_fields/common/errors';
import {Locale} from '@/hosted_fields/common/types';
import sanitizeError from '@/internal/common/error-sanitizer';
import Helpers from '@/helpers';

// EBE - Move logging utils outside callback

type Options = {
  paymentIntent: PaymentIntent;
  locale?: Locale;
  paymentInfo: PaymentInfo;
};

export default class CallbackHandler {
  callbacks: Callbacks;
  options: Options;

  private currentHistoryCount = 0;

  private startTime: number;
  private endTime: number;

  private resolve: (PaymentIntent) => void;
  private reject: (Error) => void;

  constructor(callbacks: Callbacks, options: Options) {
    this.sanitizeCallbacks(callbacks);
    this.callbacks = callbacks;
    this.options = options;
  }

  triggerSuccessCallback() {
    this.endTime = new Date().getTime();
    this.logTimeTaken('success');

    const intent = this.getPaymentIntent();
    if (this.callbacks && this.callbacks.success) {
      this.callbacks.success(intent);
    }
    if (this.resolve) this.resolve(intent);
    this.goBackInHistory();
  }

  triggerErrorCallback(error) {
    this.setEndTime();
    this.kvl(error);
    this.logTimeTaken('error');

    let sError = sanitizeError(error, this.options.locale);
    const intent = this.getPaymentIntent();
    if (this.callbacks && this.callbacks.error) {
      this.callbacks.error(intent, sError);
    }
    if (sError instanceof ClientError) error = jsonify(sError);

    this.logError(sError);
    if (this.reject) this.reject(sError);

    this.goBackInHistory();
  }

  triggerCancelCallback(data?: any) {
    if (this.callbacks && this.callbacks.cancel) {
      this.callbacks.cancel(data);
    }
  }

  async triggerClickCallback() {
    if (this.callbacks && this.callbacks.click) {
      await this.callbacks.click();
    }
  }

  triggerChangeCallback() {
    const intent = this.getPaymentIntent();
    const attempt = this.getPaymentAttempt();
    if (this.callbacks && this.callbacks.change) {
      this.callbacks.change(intent, attempt.status);
    }
  }

  triggerChallengeCallback(data?: any) {
    if (this.callbacks && this.callbacks.challenge) {
      this.callbacks.challenge(data);
    }
  }

  intentError(): ClientError {
    const intent = this.getPaymentIntent();
    const attempt = intent.active_payment_attempt;

    if (attempt.error_code || attempt.error_text || attempt.error_msg) {
      let message = attempt.error_text || attempt.error_msg || '';
      message = message.split('request-id')[0].trim();
      return new ClientError({
        name: `PAYMENT_ATTEMPT_${attempt.status.toUpperCase()}`,
        code: attempt.error_code,
        message,
      });
    }
  }

  setPromiseResolvers(resolver: (PaymentIntent) => void, rejector: (Error) => void) {
    this.resolve = resolver;
    this.reject = rejector;
  }

  setHistoryCount(count: number) {
    this.currentHistoryCount = count;
  }

  setStartTime() {
    this.startTime = new Date().getTime();
  }

  setEndTime() {
    this.endTime = new Date().getTime();
  }

  kvl(data: any): Promise<any> {
    return sendToMasterIframe(M.Actions.CaptureKVL, {
      ...jsonify(data),
      ...this.getMetadata(),
    });
  }

  logError(error, extraData = {}): Promise<any> {
    const {site_meta, three_ds_meta} = this.getMetadata();
    Object.assign(extraData, {site_meta, three_ds_meta});

    return sendToMasterIframe(M.Actions.CaptureException, {
      error: jsonify(error),
      extraData,
    });
  }

  logTimeTaken(status: string) {
    this.kvl({
      action: 'threeds_time_taken',
      threeds_start_time: this.startTime,
      threeds_end_time: this.endTime,
      threeds_time_taken: this.endTime - this.startTime,
      resp_status: status,
    });
  }

  private sanitizeCallbacks(userCallbacks: Callbacks): Callbacks {
    const allowedCallbacks = ['success', 'error', 'change'];

    allowedCallbacks.map((prop) => {
      const callback = userCallbacks[prop];
      if (callback && typeof callback !== 'function') {
        console.warn(`Invalid ${prop} callback specified`);
        delete userCallbacks[prop];
      }
    });

    return userCallbacks;
  }

  private getPaymentIntent(): PaymentIntent {
    return this.options && this.options.paymentIntent;
  }

  private getPaymentAttempt(): PaymentAttempt {
    return this.getPaymentIntent().active_payment_attempt;
  }

  public setPaymentIntent(intent: PaymentIntent) {
    if (this.options) this.options.paymentIntent = intent;
  }

  private goBackInHistory() {
    const isCbCheckout = Helpers.getCbInstance().options.forCbCheckout;
    if (isCbCheckout && window.history.state) {
      window.history.go(this.currentHistoryCount - window.history.length - 1);
    }
  }

  private givenPaymentInfo(): string {
    return this.options.paymentInfo.element
      ? 'element'
      : this.options.paymentInfo.tokenizer
      ? 'tokenizer'
      : this.options.paymentInfo.card
      ? 'card'
      : this.getPaymentIntent().reference_id
      ? 'reference_id'
      : this.options.paymentInfo.cbToken
      ? 'cb_token'
      : 'none';
  }

  getMetadata(): any {
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

    if (this.options.paymentInfo) {
      Object.assign(threeDSInfo, {
        paymentInput: {
          type: this.givenPaymentInfo(),
          additionalDataPresent: !!this.options.paymentInfo.additionalData,
        },
      });
    }

    const data = {
      site_meta: Helpers.getSiteMetaData(),
      three_ds_meta: threeDSInfo,
    };

    return data;
  }
}
