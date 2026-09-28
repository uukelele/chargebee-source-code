import {NequiPayment} from '@/hosted_fields/common/base-types';
import {CbError} from '@/hosted_fields/common/errors';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {PaymentAttempt, PaymentAttemptStatus} from '@/internal/payment-intent/types';
import {PaymentRedirectTimeouts} from '@/constants/enums';
import Helpers from '@/helpers';
import {renderQrPaymentModal, QrPaymentModalDefaults} from '@/internal/auth-redirect/qr-payment-modal';
import {toQrImageDataUrl} from '@/internal/auth-redirect/qr-image';
import {PaymentInfo} from '../types';

// QR-modal challenge (like WechatPay/Payconiq) — payload shape is gateway-specific (see handlers/dlocal.ts).
export default class NequiHandler extends PaymentIntentHandler implements NequiPayment {
  protected declare paymentInfo: PaymentInfo;
  redirectTimeout: number = PaymentRedirectTimeouts.NEQUI;

  constructor(...args) {
    super(...args);
  }

  // QR only — no redirect_url for this PM. dLocal returns both formats under the same
  // `ticket.qr_code`: a ready-made base64 image in sandbox, the raw payload in production
  // (`qr_code_data`), which is encoded client-side.
  private challengeFlow(paymentAttempt: PaymentAttempt): Promise<any> {
    const payload = paymentAttempt.action_payload;
    const qrSource = payload && (payload.qr_code_image_url || payload.qr_code_data);
    if (!qrSource) {
      return Promise.reject(new CbError('QR code is missing in payment attempt payload'));
    }
    return toQrImageDataUrl(qrSource).then((qrImageUrl) => {
      this.renderQR(qrImageUrl);
      return this.pollForAuthCompletion();
    });
  }

  protected handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_CHALLENGE:
      case PaymentAttemptStatus.REQUIRES_REDIRECTION: {
        return this.challengeFlow(paymentAttempt).then((data) => {
          this.setPaymentIntent(data.payment_intent);
          return this.handlePaymentAttempt(this.getPaymentAttempt());
        });
      }
      case PaymentAttemptStatus.AUTHORIZED: {
        this.callbackTriggered = true;
        this.callbackHandler.triggerSuccessCallback();
        return Promise.resolve(this.getPaymentIntent());
      }
      case PaymentAttemptStatus.REFUSED: {
        if (this.lightbox) {
          this.lightbox.close();
          this.lightbox.destroy();
        }
        this.callbackTriggered = true;
        const error = this.callbackHandler.intentError();
        this.callbackHandler.triggerErrorCallback(error);
        return Promise.reject(error);
      }
    }
  }

  renderQR = (qrImageUrl: string) => {
    this.lightbox = renderQrPaymentModal({
      modalId: 'nequi',
      qrCode: qrImageUrl,
      qrAlt: 'Nequi QR Code',
      renderOptions: {
        heading: 'Scan QR code to pay',
        instruction: QrPaymentModalDefaults.instruction,
        timerLabel: 'This QR code is valid for: {time}',
        // Matches the actual poll ceiling (redirectTimeout), not any gateway-reported QR validity.
        timerDurationSeconds: this.redirectTimeout / 1000,
        waitingMessage: QrPaymentModalDefaults.waitingMessage,
        accentColor: QrPaymentModalDefaults.accentColor,
      },
      isMobile: Helpers.isMobileOrTablet(),
      onDismiss: () => this.abandonPendingAuthorization(),
    });
  };
}
