import {CbError} from '@/hosted_fields/common/errors';
import {PaymentAttempt, PaymentAttemptStatus} from '@/internal/payment-intent/types';
import PixHandler from '@/plugins/payments/pix/handlers';
import {adyenRenderQrAndAwaitAuthorization} from '@/utils/payments/adyen';

/**
 * The window openpay asks Adyen to honour, in seconds, for the codes Adyen hands back without an
 * expiry of its own (`AdyenPix.PixBuilder.QR_VALIDITY_MINUTES` — keep the two in step).
 *
 * A paid payment carries `pix.expirationDate` and this is never reached. A zero-amount Pix
 * Automático enrolment carries no expiry at all, and used to inherit UPI's five minutes: the
 * shopper watched a code they had fifteen minutes to scan run out in five.
 */
const PIX_QR_FALLBACK_TIMER_SECONDS = 15 * 60;

/**
 * Pix on Adyen,  one-time and Pix Automático.
 *
 * The other Pix gateways redirect the shopper to the provider, which is why the base handler waits
 * on a `redirect_url`. Adyen answers a `qrCode` action instead, so the code is drawn in our own QR
 * modal and the wait is on our own intent, which the Adyen `AUTHORISATION` webhook settles — the
 * same shape as Adyen Payconiq.
 *
 * Adyen's Web SDK is deliberately not used at all here. Its component completes through
 * `PaymentInitiation/v1/status`, an endpoint Adyen documents nowhere and which answers 422 for a
 * Pix Automático enrolment, leaving the code on screen for its full expiry window on a payment
 * that has already succeeded. Raised with Adyen; waiting on the intent sidesteps it entirely.
 *
 * Since nothing in a Pix payment mounts an Adyen component — the statuses that would are the
 * 3DS-shaped ones, which Pix cannot reach — the SDK is never loaded, and the Adyen CDN, the client
 * key and the origin key cannot stand between a shopper and the code.
 */
export default class AdyenPixHandler extends PixHandler {
  constructor(handler: PixHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  /**
   * Carries the caller's one-time intent onto the confirm payload, which `PixHandler.initPayment`
   * builds by hand and so drops.
   *
   * Without this the field never leaves the browser — `initiateAuthorization` confirms with exactly
   * what `initPayment` returns — so cb-app keeps its `retainPaymentMethod` default of true and a
   * Pay Now Pix, paid with a freshly entered code, is vaulted as a saved payment source even though
   * the collect asked for `retain_payment_source: false`. The collect cannot assert it on its own
   * either: what the attempt recorded at confirm is reapplied over the collect's parameter, and the
   * webhook consumption that settles the code later reads that same attempt.
   *
   * Only `false` is forwarded, as the Stripe Pix, Alipay and PayTo handlers do: omitting the field
   * leaves the backend on its default rather than asserting a value the caller never set. An
   * Automático enrolment is unaffected — the portal's sub_handle path sends no `paymentType` at
   * all, and a subscription checkout sends `RECURRING`.
   */
  initPayment(): Promise<any> {
    return super.initPayment().then((paymentData: any) => {
      const paymentType = paymentData && paymentData.paymentType;
      const {retainPaymentMethod} = (this.paymentInfo || {}) as {retainPaymentMethod?: boolean};
      if (
        retainPaymentMethod === false ||
        (typeof paymentType === 'string' && paymentType.toUpperCase() === 'ONETIME')
      ) {
        paymentData.retainPaymentMethod = false;
      }
      return paymentData;
    });
  }

  protected handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    if (this.isScannable(paymentAttempt)) {
      // handlePayment pre-opens a blank tab for pix, because every other Pix gateway redirects
      // into it. Adyen has nothing to load there, and the tab would sit in front of the code.
      // Checkout asks for `redirectMode` on Adyen so it is never opened, but a caller that does
      // not — a merchant on the SDK directly — still gets one, and this is what clears it.
      this.closeTab();
      return adyenRenderQrAndAwaitAuthorization(paymentAttempt, this, {
        modalId: 'adyen-pix',
        qrAlt: 'Pix QR Code',
        heading: 'Scan the Pix code with your bank app',
        fallbackTimerSeconds: PIX_QR_FALLBACK_TIMER_SECONDS,
      }).then((data: any) => {
        this.setPaymentIntent(data.payment_intent);
        return this.handlePaymentAttemptStatus(this.getPaymentAttempt().status);
      });
    }
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.AUTHORIZED:
      case PaymentAttemptStatus.REFUSED:
        // A returning redirect re-enters here with the settled attempt, bypassing the status
        // dispatch that would otherwise have finished the payment.
        return this.handlePaymentAttemptStatus(paymentAttempt.status);
      case PaymentAttemptStatus.REQUIRES_REDIRECTION:
      case PaymentAttemptStatus.REQUIRES_CHALLENGE:
        return super.handlePaymentAttempt(paymentAttempt);
      default:
        return Promise.reject(new CbError(`Unsupported Pix payment attempt status: ${paymentAttempt.status}`));
    }
  }

  /**
   * Whether the shopper is being asked to scan, which the status alone cannot say.
   *
   * A paid enrolment parks at `pending_authorization`, but a zero-amount Pix Automático enrolment
   * is vaulting rather than payment, and cb-app parks vaulting at `requires_redirection` — the one
   * status a payment method response can carry an action on. The QR is identical either way, so
   * `requires_redirection` is only treated as scannable when a code is actually present; without
   * one it stays a real redirect and falls through to the shared Pix redirect flow.
   */
  private isScannable(paymentAttempt: PaymentAttempt): boolean {
    if (paymentAttempt.status === PaymentAttemptStatus.PENDING_AUTHORIZATION) {
      return true;
    }
    const action = paymentAttempt.action_payload;
    return paymentAttempt.status === PaymentAttemptStatus.REQUIRES_REDIRECTION && Boolean(action && action.qrCodeData);
  }
}
