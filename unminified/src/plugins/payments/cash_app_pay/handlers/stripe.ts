import {PaymentMethodType} from '@/internal/payment-intent/types';
import CashAppPayHandler from './index';
import {StripeQrPollingMixin} from '@/plugins/payments/_stripe_qr_poll/handler';

export default class StripeCashAppPayHandler extends StripeQrPollingMixin(CashAppPayHandler) {
  pollingTimeoutMessage = 'Cash App Pay polling timed out. Please try again or complete payment in the Cash App.';

  constructor(handler: CashAppPayHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.CASH_APP_PAY,
    });
  }

  getPaymentData(): any {
    const paymentAttempt = this.getPaymentAttempt();
    const actionPayload = paymentAttempt && paymentAttempt.action_payload;
    return {
      qrCode: actionPayload && actionPayload.qr_code_image_url_png,
      qrCodeData: actionPayload && actionPayload.qr_code_data,
      hostedInstructionsUrl: actionPayload && actionPayload.hosted_instructions_url,
      imageDataUrl: actionPayload && actionPayload.image_data_url,
      imageUrlPng: actionPayload && actionPayload.image_url_png,
      imageUrlSvg: actionPayload && actionPayload.image_url_svg,
      mobileAuthUrl: actionPayload && actionPayload.mobile_auth_url,
    };
  }
}
