import {loadScriptUsingPredicate} from '@/extensions/three_domain_secure/common/utils';
import {CbError} from '@/hosted_fields/common/errors';
import {fetchGatewayCredential} from '@/utils/payments/gateway-credential';

/** Progressive polling: first at 30s, then 45s, then 1min, then every 5s */
const POLL_DELAYS_MS = [30 * 1000, 15 * 1000, 15 * 1000, 10 * 1000];
const POLL_INTERVAL_AFTER_PROGRESSIVE_MS = 5 * 1000;
const MAX_POLL_DURATION_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_RETRIES = 3;
const RATE_LIMIT_BACKOFF_MS = 5000;

const TERMINAL_SUCCESS_STATUSES = ['succeeded', 'requires_capture'];
const TERMINAL_FAILURE_STATUSES = ['requires_payment_method', 'canceled', 'requires_source'];

function getPollDelayMs(pollIndex: number): number {
  return pollIndex < POLL_DELAYS_MS.length ? POLL_DELAYS_MS[pollIndex] : POLL_INTERVAL_AFTER_PROGRESSIVE_MS;
}

export function isStripeRateLimitError(err: any): boolean {
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

export type StripePaymentIntentPollOptions = {
  onSuccess: (paymentIntent: any) => Promise<any>;
  onTerminalFailure?: () => void;
  timeoutMessage?: string;
};

/**
 * Poll Stripe PaymentIntent via retrievePaymentIntent until a terminal status.
 * Success: succeeded / requires_capture → onSuccess.
 * Failure: requires_payment_method / canceled / requires_source → reject.
 * Handles 429 with retry/backoff; stops after max duration.
 */
export function startPollingForStripePaymentIntentCompletion(
  stripe: any,
  clientSecret: string,
  options: StripePaymentIntentPollOptions
): Promise<any> {
  const {onSuccess, onTerminalFailure, timeoutMessage = 'Payment polling timed out. Please try again.'} = options;

  return new Promise((resolve, reject) => {
    let pollTimeoutId: ReturnType<typeof setTimeout> | null = null;
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
      if (pollTimeoutId) {
        clearTimeout(pollTimeoutId);
        pollTimeoutId = null;
      }
    };

    const doRetrieveAndHandle = async (): Promise<void> => {
      try {
        const {paymentIntent} = await stripe.retrievePaymentIntent(clientSecret);
        inRateLimitRetry = false;

        if (TERMINAL_SUCCESS_STATUSES.includes(paymentIntent.status)) {
          clearPoll();
          try {
            const result = await onSuccess(paymentIntent);
            resolve(result);
          } catch (err) {
            reject(err);
          }
          return;
        }

        if (TERMINAL_FAILURE_STATUSES.includes(paymentIntent.status)) {
          clearPoll();
          if (onTerminalFailure) {
            onTerminalFailure();
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
        reject(new CbError(timeoutMessage));
        return;
      }

      const delayMs = getPollDelayMs(pollIndex + 1);
      pollIndex += 1;
      nextPollTimeoutId = setTimeout(() => {
        nextPollTimeoutId = null;
        runPollCycle();
      }, delayMs);

      doRetrieveAndHandle();
    };

    pollTimeoutId = setTimeout(() => {
      pollTimeoutId = null;
      runPollCycle();
    }, getPollDelayMs(0));
  });
}

export const getStripe = (): any => {
  return window['Stripe'];
};

export const getStripeV3 = (paymentIntent): any => {
  if (window['stripeV3']) {
    return Promise.resolve(window['stripeV3']);
  } else {
    return checkNLoadScript(paymentIntent);
  }
};

export const isStripeV3Available = () => {
  let stripe = getStripe();
  return stripe && (stripe.version == 3 || stripe.StripeV3);
};

export const checkNLoadScript = (paymentIntent): Promise<any> => {
  let promises: Promise<any>[] = [
    fetchGatewayCredential(paymentIntent),
    loadScriptUsingPredicate('https://js.stripe.com/v3/', () => {
      return !!isStripeV3Available();
    }),
  ];

  return new Promise<void>((resolve, reject) => {
    Promise.all(promises)
      .then((args) => {
        window['stripeV3'] = getStripe()(args[0].publishable_key);
        resolve(window['stripeV3']);
      })
      .catch((error) => {
        reject(new CbError(error));
      });
  });
};
