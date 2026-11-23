import {loadScriptUsingPredicate} from '@/extensions/three_domain_secure/common/utils';
import {CbError, ErrorType} from '@/hosted_fields/common/errors';
import {fetchGatewayCredential} from '@/utils/payments/gateway-credential';
import {createStripe} from '@/utils/payments/stripe-instance';

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

const PAYMENT_FAILURE_MESSAGE = 'Payment could not be completed. Please try again.';

function errorText(error: any, field: string): string | undefined {
  const value = error && error[field];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/** Copy only diagnostic fields: Stripe errors can also contain billing data and client secrets. */
function stripePollError(error: any, name: string, fallback: string): CbError {
  const detail: {[key: string]: string} = {};
  const fields = {
    type: 'error_category',
    code: 'error_code',
    message: 'error_message',
    decline_code: 'decline_code',
    network_decline_code: 'network_error_code',
    advice_code: 'processor_advice_code',
    param: 'error_field',
  };
  Object.keys(fields).forEach((field) => {
    const value = errorText(error, field);
    if (value) detail[fields[field]] = value;
  });
  return new CbError({
    name,
    code: errorText(error, 'code'),
    message: errorText(error, 'message') || fallback,
    type: ErrorType.GatewayError,
    detail,
  });
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
    let settled = false;
    let retrieving = false;
    let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let pollTimeoutId: ReturnType<typeof setTimeout> | null = null;
    const pollStartTime = Date.now();
    let pollIndex = 0;
    let rateLimitRetryCount = 0;
    let inRateLimitRetry = false;
    let nextPollTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let deadlineTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const clearPoll = () => {
      if (settled && deadlineTimeoutId != null) {
        clearTimeout(deadlineTimeoutId);
        deadlineTimeoutId = null;
      }
      if (retryTimeoutId != null) {
        clearTimeout(retryTimeoutId);
        retryTimeoutId = null;
      }
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
      if (settled || retrieving) return;
      retrieving = true;
      try {
        const response = await stripe.retrievePaymentIntent(clientSecret);
        // A request can finish after the polling deadline. Never emit success/error twice.
        if (settled) return;
        if (response && response.error) throw response.error;
        const paymentIntent = response && response.paymentIntent;
        if (!paymentIntent || typeof paymentIntent.status !== 'string') {
          throw new CbError('Unable to retrieve payment status. Please try again.');
        }
        inRateLimitRetry = false;

        if (TERMINAL_SUCCESS_STATUSES.includes(paymentIntent.status)) {
          settled = true;
          clearPoll();
          try {
            resolve(await onSuccess(paymentIntent));
          } catch (err) {
            reject(err);
          }
          return;
        }

        if (TERMINAL_FAILURE_STATUSES.includes(paymentIntent.status)) {
          settled = true;
          clearPoll();
          if (onTerminalFailure) onTerminalFailure();
          const lastError = paymentIntent.last_payment_error;
          // A canceled intent can retain an earlier confirmation's error; do not present it as a new decline.
          const hasDecline =
            paymentIntent.status !== 'canceled' &&
            (errorText(lastError, 'message') || errorText(lastError, 'code') || errorText(lastError, 'decline_code'));
          reject(
            hasDecline
              ? stripePollError(lastError, 'PAYMENT_ATTEMPT_REFUSED', PAYMENT_FAILURE_MESSAGE)
              : new CbError(PAYMENT_FAILURE_MESSAGE)
          );
          return;
        }
        // processing / requires_action / requires_confirmation: wait for a current terminal result.
      } catch (err) {
        if (settled) {
          // Also settle the promise if terminal UI cleanup itself throws.
          reject(err);
          return;
        }
        if (isStripeRateLimitError(err) && rateLimitRetryCount < RATE_LIMIT_MAX_RETRIES) {
          rateLimitRetryCount += 1;
          inRateLimitRetry = true;
          clearPoll();
          retryTimeoutId = setTimeout(() => {
            retryTimeoutId = null;
            doRetrieveAndHandle().then(() => {
              if (!settled && !inRateLimitRetry) {
                nextPollTimeoutId = setTimeout(runPollCycle, getPollDelayMs(pollIndex + 1));
                pollIndex += 1;
              }
            });
          }, RATE_LIMIT_BACKOFF_MS * rateLimitRetryCount);
        } else {
          settled = true;
          clearPoll();
          inRateLimitRetry = false;
          reject(
            isStripeRateLimitError(err)
              ? new CbError('Payment status check is temporarily unavailable. Please try again shortly.')
              : err instanceof CbError
              ? err
              : stripePollError(err, 'STRIPE_RETRIEVAL_ERROR', 'Unable to retrieve payment status. Please try again.')
          );
        }
      } finally {
        retrieving = false;
      }
    };

    const runPollCycle = () => {
      if (settled || inRateLimitRetry) return;

      if (Date.now() - pollStartTime > MAX_POLL_DURATION_MS) {
        settled = true;
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

    // Keep the deadline independent of requests/backoff, including a retrieval that never resolves.
    deadlineTimeoutId = setTimeout(() => {
      settled = true;
      clearPoll();
      reject(new CbError(timeoutMessage));
    }, MAX_POLL_DURATION_MS);
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
        window['stripeV3'] = createStripe(args[0].publishable_key, args[0].stripe_js_api_version);
        resolve(window['stripeV3']);
      })
      .catch((error) => {
        reject(new CbError(error));
      });
  });
};
