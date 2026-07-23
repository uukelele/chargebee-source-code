import {
  PaymentIntent,
  Callbacks,
  PaymentAttempt,
  PaymentIntentResponse,
} from '@/extensions/three_domain_secure/common/types';
import DotpayHandler from '@/plugins/payments/dotpay/handlers';
import {Master as M} from '@/hosted_fields/common/enums';
import Helpers from '@/helpers/index';
import {CbError as ClientError} from '@/hosted_fields/common/errors';
import sanitizeError from '@/extensions/three_domain_secure/common/error-sanitizer';
import {jsonify, safeGet, isObjectEmpty} from '@/utils/utility-functions';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import Ids from '@/constants/ids';
import {PaymentInfo} from '../../iDeal/types';
import {constructPaymentIntentApiPayload} from '@/internal/common/utils';

export default abstract class AbstractDotpayHandler {
  protected parent: DotpayHandler;
  protected paymentInfo: PaymentInfo;
  protected callbacks: Callbacks;
  protected iframeContainer: HTMLDivElement;
  private resolver: (PaymentIntent) => void;
  private reject: (Error) => void;
  private currentHistoryCount = 0;
  private startTime: number;
  private endTime: number;
  private reattempt: Boolean = false;

  constructor(parent: DotpayHandler) {
    this.parent = parent;
  }

  handleDotpayPayment(paymentInfo: PaymentInfo, callbacks: Callbacks = {}): Promise<PaymentIntent> {
    this.startTime = new Date().getTime();

    return new Promise<PaymentIntent>((resolve, reject) => {
      this.resolver = resolve;
      this.reject = reject;
      this.paymentInfo = paymentInfo;
      try {
        this.callbacks = this.sanitizeCallbacks(callbacks);
        this.reattempt = true;
        this.handlePayment();
      } catch (error) {
        this.callError(error);
      }
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

  abstract handlePayment(): void;

  protected abstract handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any>;

  protected closeTab() {
    this.parent.windowManager.close();
  }

  // Success callback
  protected callSuccess() {
    this.endTime = new Date().getTime();
    this.kvl({
      action: 'dotpay_time_taken',
      dotpay_start_time: this.startTime,
      dotpay_end_time: this.endTime,
      dotpay_time_taken: this.endTime - this.startTime,
      resp_status: 'success',
    });
    const intent = this.getPaymentIntent();
    if (this.callbacks && this.callbacks.success) {
      this.callbacks.success(intent);
    }
    this.resolver(intent);
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
      });
    }
  }

  // Error callback
  protected callError(error) {
    this.endTime = new Date().getTime();
    this.kvl(error);
    this.kvl({
      action: 'dotpay_time_taken',
      dotpay_start_time: this.startTime,
      dotpay_end_time: this.endTime,
      dotpay_time_taken: this.endTime - this.startTime,
      resp_status: 'error',
    });
    let sError = sanitizeError(error);
    const intent = this.getPaymentIntent();
    if (this.callbacks && this.callbacks.error) {
      this.callbacks.error(intent, sError);
    }
    if (sError instanceof ClientError) error = jsonify(sError);
    this.logError(sError);
    this.reject(sError);
  }

  // Change callback
  protected callChange() {
    const intent = this.getPaymentIntent();
    const attempt = this.getPaymentAttempt();
    if (this.callbacks && this.callbacks.change) {
      this.callbacks.change(intent, attempt.status);
    }
  }

  protected confirmPayment(data: any = {}): Promise<any> {
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
        {timeout: 10000}
      )
    ).then((intentResponse: PaymentIntentResponse) => {
      // Attach additional data to payment attempt
      intentResponse.payment_intent.active_payment_attempt.action_payload =
        intentResponse.action_payload || intentResponse.payment_intent.active_payment_attempt.action_payload;

      this.setPaymentIntent(intentResponse.payment_intent);
      return this.handlePaymentAttempt(this.getPaymentAttempt());
    });
  }

  protected fetchGatewayCredential(): Promise<any> {
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.FetchGatewayCredential,
          data: constructPaymentIntentApiPayload(this.getPaymentIntent()),
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

  protected getMetadata(): any {
    let dotpayInfo = {};
    const intent = this.getPaymentIntent();
    const attempt = this.getPaymentAttempt();

    if (intent) {
      Object.assign(dotpayInfo, {
        paymentIntent: {
          id: intent.id,
          status: intent.status,
          gatewayName: intent.gateway,
          gatewayAccountId: intent.gateway_account_id,
        },
      });
    }

    if (attempt) {
      Object.assign(dotpayInfo, {
        paymentAttempt: {
          id: attempt.id,
          status: attempt.status,
          actionPayloadPresent: !!attempt.action_payload,
        },
      });
    }

    const data = {
      site_meta: Helpers.getSiteMetaData(),
      dotpay_meta: dotpayInfo,
    };

    return data;
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
    const {site_meta, dotpay_meta} = this.getMetadata();
    Object.assign(extraData, {site_meta, dotpay_meta});

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
}
