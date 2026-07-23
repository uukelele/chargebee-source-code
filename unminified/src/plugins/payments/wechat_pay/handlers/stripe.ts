import {PaymentMethodType} from '@/internal/payment-intent/types';
import {PaymentAttempt, PaymentAttemptStatus} from '@/internal/payment-intent/types';
import WechatPayHandler from './index';
import {loadScriptUsingPredicate} from '@/extensions/three_domain_secure/common/utils';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {isStripeV3Available, getStripe} from '@/utils/payments/stripe';

const STRIPE_JS_URL = 'https://js.stripe.com/v3/';
/** Progressive polling: first at 30s, then 45s, then 1min, then every 5s */
const POLL_DELAYS_MS = [30 * 1000, 15 * 1000, 15 * 1000, 10 * 1000];
const POLL_INTERVAL_AFTER_PROGRESSIVE_MS = 5 * 1000;
const MAX_POLL_DURATION_MS = 10 * 60 * 1000; // 10 minutes from when QR is shown
const RATE_LIMIT_MAX_RETRIES = 3;
const RATE_LIMIT_BACKOFF_MS = 5000;

function getPollDelayMs(pollIndex: number): number {
  return pollIndex < POLL_DELAYS_MS.length ? POLL_DELAYS_MS[pollIndex] : POLL_INTERVAL_AFTER_PROGRESSIVE_MS;
}

interface StripeGatewayCredential {
  publishable_key: string;
}

function isStripeRateLimitError(err: any): boolean {
  if (!err) return false;
  const code = err.code || (err.error && err.error.code);
  const status = err.statusCode || (err.error && err.error.statusCode);
  const message = (err.message || (err.error && err.error.message) || '').toLowerCase();
  return (
    status === 429 ||
    code === 'rate_limit' ||
    code === 'lock_timeout' ||
    message.includes('rate limit') ||
    message.includes('429')
  );
}

export default class StripeWechatPayHandler extends WechatPayHandler {
  private gatewayCredential: StripeGatewayCredential;
  private stripe: any;
  private pollTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(handler: WechatPayHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  /**
   * Load Stripe.js SDK
   */
  private loadStripeJS(): Promise<any> {
    if (!isStripeV3Available()) {
      return loadScriptUsingPredicate(STRIPE_JS_URL, () => !!isStripeV3Available());
    }
    return Promise.resolve(getStripe());
  }

  /**
   * Preload gateway configuration and create Stripe instance
   */
  private async preloadConfig(): Promise<void> {
    const data = await this.fetchGatewayCredential();
    this.gatewayCredential = data;
  }

  /**
   * Create Stripe instance with publishable key
   */
  private createStripeInstance(): any {
    return window['Stripe'](this.gatewayCredential.publishable_key);
  }

  /**
   * Override to load Stripe, fetch credentials, then run normal authorization flow
   */
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

  /**
   * Start polling Stripe for payment status. When status is succeeded or requires_capture we stop
   * polling and call confirmPayment. requires_payment_method and canceled stop polling and reject.
   * Other statuses (processing, requires_action, etc.) keep polling.
   * Handles 429 with retry/backoff; stops after max duration.
   */
  private startPollingForCompletion(clientSecret: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.pollTimeoutId) {
        clearTimeout(this.pollTimeoutId);
        this.pollTimeoutId = null;
      }

      const pollStartTime = Date.now();
      let pollIndex = 0;
      let rateLimitRetryCount = 0;
      let inRateLimitRetry = false;
      let nextPollTimeoutId: ReturnType<typeof setTimeout> | null = null;

      const clearPoll = () => {
        if (nextPollTimeoutId != null) {
          clearTimeout(nextPollTimeoutId);
          nextPollTimeoutId = null;
        }
        if (this.pollTimeoutId) {
          clearTimeout(this.pollTimeoutId);
          this.pollTimeoutId = null;
        }
      };

      const TERMINAL_SUCCESS_STATUSES = ['succeeded', 'requires_capture'];
      const TERMINAL_FAILURE_STATUSES = ['requires_payment_method', 'canceled', 'requires_source'];

      const doRetrieveAndHandle = async (): Promise<void> => {
        try {
          const {paymentIntent} = await this.stripe.retrievePaymentIntent(clientSecret);
          inRateLimitRetry = false;

          if (TERMINAL_SUCCESS_STATUSES.includes(paymentIntent.status)) {
            clearPoll();
            try {
              const result = await this.onPaymentComplete(paymentIntent);
              resolve(result);
            } catch (err) {
              reject(err);
            }
          }

          if (TERMINAL_FAILURE_STATUSES.includes(paymentIntent.status)) {
            clearPoll();
            if (this.lightbox) {
              this.lightbox.close();
              this.lightbox.destroy();
            }
            reject(new CbError('Payment could not be completed. Please try again.'));
            return;
          }

          // Other statuses (processing, requires_action, requires_confirmation, etc.): keep polling
        } catch (err) {
          if (isStripeRateLimitError(err) && rateLimitRetryCount < RATE_LIMIT_MAX_RETRIES) {
            rateLimitRetryCount += 1;
            inRateLimitRetry = true;
            if (nextPollTimeoutId != null) {
              clearTimeout(nextPollTimeoutId);
              nextPollTimeoutId = null;
            }
            const backoff = RATE_LIMIT_BACKOFF_MS * rateLimitRetryCount;
            setTimeout(() => {
              doRetrieveAndHandle().then(
                () => {},
                (retryErr) => {
                  if (!isStripeRateLimitError(retryErr) || rateLimitRetryCount >= RATE_LIMIT_MAX_RETRIES) {
                    clearPoll();
                    inRateLimitRetry = false;
                    const message =
                      rateLimitRetryCount >= RATE_LIMIT_MAX_RETRIES
                        ? 'Payment status check is temporarily unavailable. Please try again shortly.'
                        : retryErr && (retryErr.message || (retryErr.error && retryErr.error.message));
                    reject(retryErr instanceof CbError ? retryErr : new CbError(message || retryErr));
                  }
                }
              );
            }, backoff);
          } else {
            clearPoll();
            inRateLimitRetry = false;
            reject(err instanceof CbError ? err : new CbError(err));
          }
        }
      };

      const runPollCycle = () => {
        if (inRateLimitRetry) return;

        if (Date.now() - pollStartTime > MAX_POLL_DURATION_MS) {
          clearPoll();
          reject(new CbError('WeChat Pay polling timed out. Please try again or complete payment in the WeChat app.'));
          return;
        }

        // Schedule next run (delay to next poll: 45s, 60s, 5s, 5s, ...)
        const delayMs = getPollDelayMs(pollIndex + 1);
        pollIndex += 1;
        nextPollTimeoutId = setTimeout(() => {
          nextPollTimeoutId = null;
          runPollCycle();
        }, delayMs);

        doRetrieveAndHandle();
      };

      // First poll after 30s, then 45s, then 1min, then every 5s
      this.pollTimeoutId = setTimeout(() => {
        this.pollTimeoutId = null;
        runPollCycle();
      }, getPollDelayMs(0));
    });
  }

  /**
   * Called when Stripe PaymentIntent status is succeeded or requires_capture; call confirmPayment so backend stays in sync.
   */
  private onPaymentComplete(_stripePaymentIntent: any): Promise<any> {
    return this.confirmPayment().then(
      (result) => {
        if (this.lightbox) {
          this.lightbox.close();
          this.lightbox.destroy();
        }
        return result;
      },
      (err) => {
        if (this.lightbox) {
          this.lightbox.close();
          this.lightbox.destroy();
        }
        throw err;
      }
    );
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.WECHAT_PAY,
    });
  }

  protected handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
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
        if (this.lightbox) {
          this.lightbox.close();
          this.lightbox.destroy();
        }
        this.callbackHandler.triggerSuccessCallback();
        return Promise.resolve(this.getPaymentIntent());
      }
      case PaymentAttemptStatus.REFUSED: {
        if (this.lightbox) {
          this.lightbox.close();
          this.lightbox.destroy();
        }
        this.callbackHandler.triggerErrorCallback(this.callbackHandler.intentError());
        return Promise.reject(this.callbackHandler.intentError());
      }
      default:
        return Promise.reject(new CbError('UNHANDLED_PAYMENT_STATUS'));
    }
  }

  getPaymentData(): any {
    const paymentAttempt = this.getPaymentAttempt();
    const actionPayload = paymentAttempt && paymentAttempt.action_payload;

    const payload: any = {
      qrCode: (actionPayload && actionPayload.image_url_png) || null,
      qrCodeData: (actionPayload && actionPayload.qr_code_data) || null,
      hostedInstructionsUrl: (actionPayload && actionPayload.hosted_instructions_url) || null,
      imageDataUrl: (actionPayload && actionPayload.image_data_url) || null,
      imageUrlSvg: (actionPayload && actionPayload.image_url_svg) || null,
    };
    return payload;
  }
}
