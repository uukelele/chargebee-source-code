import {loadScriptUsingPredicate} from '@/extensions/three_domain_secure/common/utils';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {getStripe, isStripeV3Available, startPollingForStripePaymentIntentCompletion} from '@/utils/payments/stripe';
import {retrievePaymentIntent} from '@/internal/payment-intent/handler';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {PaymentAttempt, PaymentAttemptStatus} from '@/internal/payment-intent/types';

const STRIPE_JS_URL = 'https://js.stripe.com/v3/';

type GConstructor<T> = new (...args: any[]) => T;
type QrBaseHandler = PaymentIntentHandler & {
  renderQR(): void;
  getPaymentData(): any;
  setPaymentData(data: any): void;
};

/**
 * Public API surface that StripeQrPollingMixin adds to any base class.
 * Exporting this interface (instead of the class expression) lets TypeScript
 * emit clean declaration files without triggering TS4094.
 */
export interface StripeQrHandlerAdditions {
  pollingTimeoutMessage: string;
  gatewayCredential: {publishable_key: string};
  stripe: any;
  loadStripeJS(): Promise<any>;
  preloadConfig(): Promise<void>;
  createStripeInstance(): any;
  initiateAuthorization(paymentInfo: any, callbacks?: any): Promise<any>;
  closeLightbox(): void;
  startPollingForCompletion(clientSecret: string): Promise<any>;
  onPaymentComplete(stripePaymentIntent: any): Promise<any>;
  handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any>;
}

/**
 * Mixin that provides the shared Stripe QR-code polling flow used by WeChat Pay
 * and Cash App Pay. Apply it to the payment-method's index handler:
 *
 *   export default class StripeXxxHandler extends StripeQrPollingMixin(XxxHandler) { ... }
 *
 * The concrete class must set `pollingTimeoutMessage` and implement `initPayment`
 * and `getPaymentData`.
 *
 * The explicit return type `TBase & GConstructor<StripeQrHandlerAdditions>` prevents
 * TS4094 during declaration emit: TypeScript uses the named interface for the .d.ts
 * output rather than the anonymous class expression, which would expose inherited
 * protected members and trigger the error.
 */
export function StripeQrPollingMixin<TBase extends GConstructor<QrBaseHandler>>(
  Base: TBase
): TBase & GConstructor<StripeQrHandlerAdditions> {
  class StripeQrHandler extends Base {
    // Set as a property in the concrete subclass.
    pollingTimeoutMessage!: string;

    gatewayCredential: {publishable_key: string};
    stripe: any;

    loadStripeJS(): Promise<any> {
      if (!isStripeV3Available()) {
        return loadScriptUsingPredicate(STRIPE_JS_URL, () => !!isStripeV3Available());
      }
      return Promise.resolve(getStripe());
    }

    async preloadConfig(): Promise<void> {
      const data = await this.fetchGatewayCredential();
      this.gatewayCredential = data;
    }

    createStripeInstance(): any {
      return window['Stripe'](this.gatewayCredential.publishable_key);
    }

    initiateAuthorization(paymentInfo: any, callbacks?: any): Promise<any> {
      return this.loadStripeJS()
        .then(() => this.preloadConfig())
        .then(() => {
          this.stripe = this.createStripeInstance();
          if (!this.stripe) {
            throw new CbError(Errors.missingStripeInstance);
          }
          return super.initiateAuthorization(paymentInfo, callbacks);
        });
    }

    closeLightbox(): void {
      if (this.lightbox) {
        this.lightbox.close();
        this.lightbox.destroy();
      }
    }

    startPollingForCompletion(clientSecret: string): Promise<any> {
      return startPollingForStripePaymentIntentCompletion(this.stripe, clientSecret, {
        onSuccess: (paymentIntent) => this.onPaymentComplete(paymentIntent),
        onTerminalFailure: () => this.closeLightbox(),
        timeoutMessage: this.pollingTimeoutMessage,
      });
    }

    onPaymentComplete(_stripePaymentIntent: any): Promise<any> {
      return this.confirmPayment().then(
        (result) => {
          this.closeLightbox();
          return result;
        },
        (err) => {
          // Stripe webhook may reach Chargebee before this confirmPayment call,
          // causing a 400 "payment_intent_authorized" or "payment_intent_consumed" error.
          // Retrieve the live intent and re-route through handlePaymentAttempt so the
          // AUTHORIZED state is set correctly before the success callback fires —
          // ensuring the bulk checkout call sends payment_intent_id, not raw payment_method params.
          const isAlreadyAuthorized =
            (err && err.error_code === 'payment_intent_authorized') ||
            (err && err.error_code === 'payment_intent_consumed') ||
            (err &&
              typeof err.message === 'string' &&
              (err.message === 'Payment intent is authorized' || err.message === 'Payment intent is consumed'));
          if (isAlreadyAuthorized) {
            return retrievePaymentIntent(this.getPaymentIntent().id).then((data: any) => {
              this.setPaymentIntent(data.payment_intent);
              return this.handlePaymentAttempt(this.getPaymentAttempt());
            });
          }
          this.closeLightbox();
          if (!this.callbackTriggered) {
            this.callbackHandler.triggerErrorCallback(err instanceof CbError ? err : new CbError(err));
          }
          throw err;
        }
      );
    }

    handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
      switch (paymentAttempt.status) {
        case PaymentAttemptStatus.REQUIRES_CHALLENGE:
        case PaymentAttemptStatus.REQUIRES_REDIRECTION:
        case PaymentAttemptStatus.PENDING_AUTHORIZATION: {
          const payload = paymentAttempt.action_payload;
          const clientSecret = payload && payload.client_secret;
          if (!clientSecret) {
            return Promise.reject(new CbError('Missing client_secret in payment attempt payload'));
          }
          if (this.getPaymentData) {
            this.setPaymentData(this.getPaymentData());
          }
          this.renderQR();
          return this.startPollingForCompletion(clientSecret).then(() => this.getPaymentIntent());
        }
        case PaymentAttemptStatus.AUTHORIZED: {
          this.closeLightbox();
          this.callbackHandler.triggerSuccessCallback();
          return Promise.resolve(this.getPaymentIntent());
        }
        case PaymentAttemptStatus.REFUSED: {
          this.closeLightbox();
          this.callbackHandler.triggerErrorCallback(this.callbackHandler.intentError());
          return Promise.reject(this.callbackHandler.intentError());
        }
        default:
          return Promise.reject(new CbError('UNHANDLED_PAYMENT_STATUS'));
      }
    }
  }

  return StripeQrHandler as unknown as TBase & GConstructor<StripeQrHandlerAdditions>;
}
