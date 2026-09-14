import {PaymentMethodType} from '@/internal/payment-intent/types';
import {buildBillingPaymentMethodDetails} from '@/internal/common/utils';
import WechatPayHandler from './index';
import {StripeQrPollingMixin} from '@/plugins/payments/_stripe_qr_poll/handler';

export default class StripeWechatPayHandler extends StripeQrPollingMixin(WechatPayHandler) {
  pollingTimeoutMessage = 'WeChat Pay polling timed out. Please try again or complete payment in the WeChat app.';

  constructor(handler: WechatPayHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment() {
    const paymentMethodDetails = buildBillingPaymentMethodDetails(this.paymentInfo);

    return Promise.resolve({
      paymentMethodType: PaymentMethodType.WECHAT_PAY,
      ...(paymentMethodDetails ? {paymentMethodDetails} : {}),
    });
  }

  getPaymentData(): any {
    const paymentAttempt = this.getPaymentAttempt();
    const actionPayload = paymentAttempt && paymentAttempt.action_payload;
    return {
      qrCode: (actionPayload && actionPayload.image_url_png) || null,
      qrCodeData: (actionPayload && actionPayload.qr_code_data) || null,
      hostedInstructionsUrl: (actionPayload && actionPayload.hosted_instructions_url) || null,
      imageDataUrl: (actionPayload && actionPayload.image_data_url) || null,
      imageUrlSvg: (actionPayload && actionPayload.image_url_svg) || null,
    };
  }
}
