import {PaymentAttempt, PaymentAttemptStatus} from '@/internal/payment-intent/types';
import UpiHandler from '@/plugins/payments/upi/handlers';
import {adyenRenderQrAndAwaitAuthorization} from '@/utils/payments/adyen';
import {isObjectEmpty} from '@/utils/utility-functions';

/**
 * Adyen returns no expiry on a UPI response, so this is the only window the shopper ever sees.
 * Five minutes is Adyen's own guidance, given for UPI QR, Intent and Collect alike.
 */
const UPI_QR_FALLBACK_TIMER_SECONDS = 5 * 60;

/**
 * UPI on Adyen, one-time QR and UPI Autopay.
 *
 * Razorpay drives UPI through its own JS SDK and Stripe through a redirect. Adyen answers a
 * `qrCode` action, so the code is drawn in our own QR modal and the wait is on our own intent,
 * which the Adyen `AUTHORISATION` webhook settles — the same shape as Adyen Payconiq.
 *
 * Adyen's Web SDK is deliberately not used at all here: its component completes through the
 * undocumented `PaymentInitiation/v1/status` poll, which leaves us no way to observe or retry a
 * payment it cannot resolve. UPI needs the webhook regardless, because resolving a UPI payment does
 * not authorise it — Adyen answers `Received` and the money question is settled later.
 *
 * Since nothing in a UPI payment mounts an Adyen component — the statuses that would are the
 * 3DS-shaped ones, which UPI cannot reach — the SDK is never loaded, and the Adyen CDN, the client
 * key and the origin key cannot stand between a shopper and the code.
 */
export default class AdyenUpiHandler extends UpiHandler {
  constructor(handler: UpiHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  /**
   * Carries the caller's one-time intent onto the confirm payload, which `UpiHandler.initPayment`
   * builds by hand and so drops.
   *
   * Only `false` is forwarded, as the Stripe Alipay, Pix and PayTo handlers do: omitting the field
   * leaves the backend on its `retainPaymentMethod` default rather than asserting a value the
   * caller never set. `paymentType` is honoured too, for a direct integration that sends the
   * one-time signal the way Stripe UPI callers do — but note that a subscription checkout sends
   * `RECURRING` there, so `retainPaymentMethod` is the only field that can say "never vault this".
   */
  initPayment(): Promise<any> {
    return super.initPayment().then((paymentData: any) => {
      const paymentType = paymentData && paymentData.paymentType;
      const {retainPaymentMethod} = this.paymentInfo as {retainPaymentMethod?: boolean};
      if (
        retainPaymentMethod === false ||
        (typeof paymentType === 'string' && paymentType.toUpperCase() === 'ONETIME')
      ) {
        paymentData.retainPaymentMethod = false;
      }
      const billingAddress = paymentData.customer && paymentData.customer.billingAddress;
      if (billingAddress && !isObjectEmpty(billingAddress)) {
        paymentData.paymentMethodDetails = {billingAddress};
      }
      return paymentData;
    });
  }

  handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    if (paymentAttempt.status === PaymentAttemptStatus.PENDING_AUTHORIZATION) {
      return this.awaitAuthorization(paymentAttempt);
    }
    // Everything else is the shared UPI shape: a redirect, or a status that settles the payment.
    return super.handlePaymentAttempt(paymentAttempt);
  }

  /**
   * Waits for the `AUTHORISATION` webhook. The attempt carries the QR action on the way in, so the
   * code is rendered before waiting; a later pass through here has nothing left to show.
   */
  private awaitAuthorization(paymentAttempt: PaymentAttempt): Promise<any> {
    const action = paymentAttempt.action_payload;
    let wait: Promise<any>;
    if (action && action.qrCodeData) {
      // UPI opens no tab of its own — it is absent from TabRedirectPayments, because the
      // gateways that redirect do so through an iframe. This clears that iframe if the base
      // handler opened one before the attempt came back with a code to show instead.
      this.closeTab();
      wait = adyenRenderQrAndAwaitAuthorization(paymentAttempt, this, {
        modalId: 'adyen-upi',
        qrAlt: 'UPI QR Code',
        heading: 'Scan the QR code with any UPI app',
        fallbackTimerSeconds: UPI_QR_FALLBACK_TIMER_SECONDS,
        buttonText: 'Pay with UPI app',
        payloadIsDeepLink: true,
      });
    } else {
      wait = this.pollForAuthCompletion();
    }
    return wait.then((data: any) => {
      this.setPaymentIntent(data.payment_intent);
      return this.handlePaymentAttemptStatus(this.getPaymentAttempt().status);
    });
  }
}
