import {
  PaymentIntent,
  Callbacks,
  PaymentAttempt,
  PaymentIntentResponse,
} from '@/extensions/three_domain_secure/common/types';
import GooglePayHandler from '@/extensions/payments/google_pay/index';
import {Master as M} from '@/hosted_fields/common/enums';
import Helpers from '@/helpers/index';
import {CbError as ClientError} from '@/hosted_fields/common/errors';
import sanitizeError from '@/extensions/three_domain_secure/common/error-sanitizer';
import {jsonify, getCurrencyDivisor} from '@/utils/utility-functions';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import Ids from '@/constants/ids';
import {ButtonOption, PaymentData, PaymentRequestOptions} from '@/plugins/payments/google_pay/types';
import {constructPaymentIntentApiPayload} from '@/internal/common/utils';
import LightBox from '@/extensions/three_domain_secure/common/lightbox';

export default abstract class AbstractGooglePayHandler {
  protected parent: GooglePayHandler;
  protected callbacks: Callbacks;
  protected iframeContainer: HTMLDivElement;
  private resolver: (PaymentIntent) => void;
  private reject: (Error) => void;
  private startTime: number;
  private endTime: number;
  protected reattempt: Boolean = false;
  protected approvedPayload: any;
  protected lightbox: LightBox;

  constructor(parent: GooglePayHandler) {
    this.parent = parent;
  }

  abstract mountPaymentButton(
    id: string,
    buttonStyle: ButtonOption,
    paymentRequestOptions: PaymentRequestOptions
  ): Promise<any>;

  protected abstract handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any>;

  handleGooglePayment(callbacks: Callbacks = {}): Promise<PaymentIntent> {
    this.startTime = new Date().getTime();

    return new Promise<PaymentIntent>((resolve, reject) => {
      this.resolver = resolve;
      this.reject = reject;
      try {
        this.callbacks = this.sanitizeCallbacks(callbacks);
        this.reattempt = true;
      } catch (error) {
        this.callError(error);
      }
    });
  }

  private sanitizeCallbacks(userCallbacks: Callbacks): Callbacks {
    const allowedCallbacks = ['success', 'error', 'cancel'];
    allowedCallbacks.map((prop) => {
      const callback = userCallbacks[prop];
      if (callback && typeof callback !== 'function') {
        console.warn(`Invalid ${prop} callback specified`);
        delete userCallbacks[prop];
      }
    });
    return userCallbacks;
  }

  // Success callback
  protected callSuccess() {
    this.endTime = new Date().getTime();
    this.kvl({
      action: 'google_pay_time_taken',
      google_pay_start_time: this.startTime,
      google_pay_end_time: this.endTime,
      google_pay_time_taken: this.endTime - this.startTime,
      resp_status: 'success',
    });
    const response = {
      paymentIntent: this.getPaymentIntent(),
      paymentData: this.getPaymentData(),
    };
    if (this.callbacks && this.callbacks.success) {
      this.kvl({
        action: 'google_pay_success_callback',
        result: 'true',
      });
      this.callbacks.success(response);
    }
    if (typeof this.resolver == 'function') {
      this.kvl({
        action: 'google_pay_resolver',
        result: 'true',
      });
      this.resolver(response);
    } else {
      this.kvl({
        action: 'google_pay_resolver',
        result: 'false',
      });
    }
  }

  // click callback
  protected async callClick() {
    if (this.callbacks && this.callbacks.click) {
      await this.callbacks.click();
    }
  }

  // cancel callback
  protected async callCancel() {
    if (this.callbacks && this.callbacks.cancel) {
      await this.callbacks.cancel();
    }
  }

  protected intentError(): ClientError {
    const intent = this.getPaymentIntent();
    const attempt = intent && intent.active_payment_attempt;

    if (attempt && (attempt.error_code || attempt.error_text || attempt.error_msg)) {
      let message = attempt.error_text || attempt.error_msg || '';
      message = message.split('request-id')[0].trim();
      return new ClientError({
        name: `PAYMENT_ATTEMPT_${attempt.status.toUpperCase()}`,
        code: attempt.error_code,
        message,
      });
    }

    // Always return a ClientError so callers using `throw this.intentError()` never
    // throw `undefined`, which would otherwise produce uncaught TypeErrors downstream.
    const status = attempt && attempt.status ? attempt.status.toUpperCase() : 'FAILED';
    return new ClientError({
      name: `PAYMENT_ATTEMPT_${status}`,
      message: 'Payment could not be completed',
    });
  }

  // Error callback
  protected callError(error) {
    this.endTime = new Date().getTime();
    this.kvl(error);
    this.kvl({
      action: 'google_pay_time_taken',
      google_pay_start_time: this.startTime,
      google_pay_end_time: this.endTime,
      google_pay_time_taken: this.endTime - this.startTime,
      resp_status: 'error',
    });
    let sError = sanitizeError(error);
    const intent = this.getPaymentIntent();
    if (this.callbacks && this.callbacks.error) {
      this.callbacks.error(intent, sError);
    }
    if (sError instanceof ClientError) error = jsonify(sError);
    if (sError && !sError.name) sError.name = `GPAY_ERROR_${error.statusCode ? `_${error.statusCode}` : ''}`;
    this.logError(sError);
    this.reject(sError);
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

      if (this.approvedPayload) {
        intentResponse.payment_intent.payer_info = this.getPayerInfo();
      }

      this.setPaymentIntent(intentResponse.payment_intent);
      return this.handlePaymentAttempt(this.getPaymentAttempt());
    });
  }

  private getPayerInfo() {
    let out: any = {};
    const pp = this.approvedPayload;
    if (!pp) {
      return out;
    }
    out.customer = {
      email: pp.email,
    };
    if (pp.cardDetails) {
      out.card = {
        last4: pp.cardDetails,
      };
    }
    if (pp.billingAddress) {
      out.billing_address = {
        firstName: pp.firstName,
        lastName: pp.lastName,
        phone: pp.phone,
        addressLine1: pp.billingAddress.line1,
        addressLine2: pp.billingAddress.line2,
        zip: pp.billingAddress.postalCode,
        state: pp.billingAddress.state,
        city: pp.billingAddress.city,
        countryCode: pp.billingAddress.countryCode,
      };
      let names = pp.billingAddress.name && pp.billingAddress.name.split(' ');
      if (names && names.length > 1) {
        out.billing_address.firstName = names[0];
        out.billing_address.lastName = names[1];
      }
    }

    if (pp.shippingAddress) {
      out.shipping_address = {
        firstName: pp.shippingAddress.name,
        addressLine1: pp.shippingAddress.address1,
        addressLine2: pp.shippingAddress.address2,
        zip: pp.shippingAddress.postalCode,
        state: pp.shippingAddress.administrativeArea,
        city: pp.shippingAddress.locality,
        countryCode: pp.shippingAddress.countryCode,
        phone: pp.shippingAddress.phone,
      };
      let names = pp.shippingAddress.name && pp.shippingAddress.name.split(' ');
      if (names && names.length > 1) {
        out.shipping_address.firstName = names[0];
        out.shipping_address.lastName = names[1];
      }
    }
    return out;
  }

  protected generateBraintreeClientToken(): Promise<any> {
    const payload: any = constructPaymentIntentApiPayload(this.getPaymentIntent());
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

  protected fetchGatewayCredential(): Promise<any> {
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.FetchGatewayCredential,
          data: constructPaymentIntentApiPayload(this.getPaymentIntent()),
        },
        Ids.MASTER_FRAME,
        {timeout: 20000}
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

  protected setPaymentData(paymentData: PaymentData) {
    this.parent.paymentData = paymentData;
  }

  protected getPaymentData(): PaymentData {
    return this.parent.paymentData;
  }

  protected getEnvironment(): string {
    return Helpers.isTestSite() ? 'TEST' : 'PRODUCTION';
  }

  protected getGoogleTransactionInfo(): any {
    const currencyDivisor = getCurrencyDivisor(this.getPaymentIntent().currency_code);
    return {
      currencyCode: this.getPaymentIntent().currency_code,
      totalPriceStatus: 'FINAL',
      totalPrice: (this.getPaymentIntent().amount / currencyDivisor).toFixed(2),
    };
  }

  protected getMetadata(): any {
    let info = {};
    const intent = this.getPaymentIntent();
    const attempt = this.getPaymentAttempt();

    if (intent) {
      Object.assign(info, {
        paymentIntent: {
          id: intent.id,
          status: intent.status,
          gatewayName: intent.gateway,
          gatewayAccountId: intent.gateway_account_id,
        },
      });
    }

    if (attempt) {
      Object.assign(info, {
        paymentAttempt: {
          id: attempt.id,
          status: attempt.status,
          actionPayloadPresent: !!attempt.action_payload,
        },
      });
    }

    const data = {
      site_meta: Helpers.getSiteMetaData(),
      google_pay_meta: info,
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
    const {site_meta, google_pay_meta} = this.getMetadata();
    Object.assign(extraData, {site_meta, google_pay_meta});

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
}
