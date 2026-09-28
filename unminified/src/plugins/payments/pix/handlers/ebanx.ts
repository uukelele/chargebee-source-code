import PixHandler from '@/plugins/payments/pix/handlers/index';
import {PaymentAttempt, PaymentAttemptStatus} from '@/internal/payment-intent/types';
import {renderQrPaymentModal, QrPaymentModalDefaults} from '@/internal/auth-redirect/qr-payment-modal';
import Helpers from '@/helpers';
import * as QRCode from 'qrcode';

/**
 * EBANX gateway-specific PIX handler.
 *
 * EBANX returns the copy-paste EMV payload (`qr_code_value`) on the challenge action, so the
 * payer never has to leave checkout: we draw the QR in the shared lightbox and wait for the
 * payment intent worker to report authorization, the same shape Payconiq and WeChat Pay use.
 * When the payload is missing we fall back to EBANX's hosted voucher page so the charge is
 * still completable.
 */
export default class EbanxPixHandler extends PixHandler {
  constructor(handler: PixHandler, ...args) {
    super(...args);
    // Copy properties from parent handler
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  protected handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_REDIRECTION:
      case PaymentAttemptStatus.REQUIRES_CHALLENGE: {
        this.markPaymentAttemptsAsAuthorized();
        return this.challengeFlow(paymentAttempt).then((data) => {
          this.setPaymentIntent(data.payment_intent);
          return this.handlePaymentAttempt(this.getPaymentAttempt());
        });
      }
    }
  }

  private getQrCodeValue(paymentAttempt: PaymentAttempt): string {
    const actionPayload = paymentAttempt && (paymentAttempt.action_payload as any);
    return (actionPayload && actionPayload.qr_code_value) || '';
  }

  private challengeFlow(paymentAttempt: PaymentAttempt): Promise<any> {
    const qrCodeValue = this.getQrCodeValue(paymentAttempt);
    if (!qrCodeValue) {
      return this.fallBackToVoucher(paymentAttempt, 'qr_code_value_absent');
    }

    return this.renderQr(qrCodeValue, paymentAttempt).then(
      () => this.pollForAuthCompletion(),
      (error) => this.fallBackToVoucher(paymentAttempt, 'qr_render_failed', error)
    );
  }

  /**
   * A QR we cannot draw is not a dead end -- EBANX's hosted voucher page carries the same payload,
   * so fall back to it rather than failing a payable charge.
   *
   * Both fallbacks look identical to the payer, so record why the in-page QR was abandoned;
   * without it a systematic encode failure is indistinguishable from ordinary redirect traffic.
   * The intent and gateway are not repeated here because `kvl` merges them in from `getMetadata`.
   */
  private fallBackToVoucher(paymentAttempt: PaymentAttempt, reason: string, error?: any): Promise<any> {
    if (this.callbackHandler) {
      const payload: any = {action: 'ebanx_pix_qr_fallback', reason};
      if (error) {
        // Gateway KVL contract: failures carry the normalized message in `error`, while
        // `reason` stays a stable category so fallback traffic can be aggregated.
        payload.error = error.message || String(error);
      }
      this.callbackHandler.kvl(payload);
    }
    return this.redirectToProvider(paymentAttempt);
  }

  private renderQr(qrCodeValue: string, paymentAttempt: PaymentAttempt): Promise<void> {
    return QRCode.toDataURL(qrCodeValue, {width: 240, margin: 2, errorCorrectionLevel: 'M'}).then((qrCode: string) => {
      const actionPayload = paymentAttempt && (paymentAttempt.action_payload as any);
      this.lightbox = renderQrPaymentModal({
        modalId: 'ebanx-pix',
        qrCode,
        qrAlt: 'Pix QR Code',
        // On a phone the payer cannot scan their own screen, so offer EBANX's hosted voucher
        // page, which repeats the QR alongside a copy-paste code.
        mobileAppUrl: actionPayload && actionPayload.redirect_url,
        renderOptions: {
          heading: 'Scan to pay with Pix',
          instruction: 'Open your bank app, choose Pix, and scan this QR code to complete the payment.',
          timerLabel: 'This QR code is valid for {time}',
          // Tied to the poll window rather than EBANX's own expiry: once we stop watching the
          // intent, a still-valid QR would leave the payer staring at a page that can no
          // longer report success.
          timerDurationSeconds: Math.floor(this.redirectTimeout / 1000),
          waitingMessage: QrPaymentModalDefaults.waitingMessage,
          accentColor: QrPaymentModalDefaults.accentColor,
          buttonText: 'Open payment page',
        },
        isMobile: Helpers.isMobileOrTablet(),
        onDismiss: () => this.abandonPendingAuthorization(),
      });
      // `handlePayment` pre-opens a redirect tab for every Pix intent, because at that point it
      // is still inside the click gesture and does not yet know the gateway. EBANX has no use
      // for it once the QR is up, and the base handler only closes it when the whole payment
      // settles -- which would leave it blank in front of the payer for the entire scan.
      //
      // Closed here rather than earlier so the fallbacks above, which branch out before this
      // point, still inherit a tab that browsers will let us navigate. `closeTab()` would also
      // destroy the lightbox created on the line above, so close only the window.
      if (this.windowManager) {
        this.windowManager.close();
      }
    });
  }

  private markPaymentAttemptsAsAuthorized(): void {
    if (Helpers.isTestSite(Helpers.getCbInstance().site)) {
      setTimeout(() => {
        this.confirmPayment();
      }, 5000);
    }
  }
}
