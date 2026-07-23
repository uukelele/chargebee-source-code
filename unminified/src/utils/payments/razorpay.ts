import {sendToMasterIframe} from '@/hosted_fields/host/iframe-client-loader';
import {constructPaymentIntentApiPayload} from '@/internal/common/utils';
import {Master as M} from '@/hosted_fields/common/enums';
import {PaymentAttemptStatus, PaymentIntent} from '@/plugins/three_domain_secure/types';
import {isDev} from '@/constants/environment';

export function fetchPaymentIntentStatus(paymentIntent: PaymentIntent): void {
  const paymentAttempt = paymentIntent && paymentIntent.active_payment_attempt;
  if (
    isDev() ||
    (paymentAttempt && ![PaymentAttemptStatus.AUTHORIZED, PaymentAttemptStatus.REFUSED].includes(paymentAttempt.status))
  ) {
    // In production we are using queueman for webhooks but for Prism & local this is a fallback to get the latest status of payment intent
    sendToMasterIframe(M.Actions.ConfirmPaymentIntent, constructPaymentIntentApiPayload(paymentIntent), {
      timeout: 120000,
    }).catch(() => {
      // empty block
    });
  }
}

export const getRazorPay = (): any => {
  return window['Razorpay'];
};
