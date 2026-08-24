import {PaymentRedirectTimeouts} from '@/constants/enums';
import {WechatPayPayment} from '@/hosted_fields/common/base-types';
import {CbError} from '@/hosted_fields/common/errors';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {Callbacks, PaymentMethodType, PaymentAttempt, PaymentAttemptStatus} from '@/internal/payment-intent/types';
import {PaymentData, RenderOptions} from '../types';
import Helpers from '@/helpers';
import {renderQrPaymentModal, QrPaymentModalDefaults} from '@/internal/auth-redirect/qr-payment-modal';

export default class WechatPayHandler extends PaymentIntentHandler implements WechatPayPayment {
  public paymentData: PaymentData;
  public renderOptions: RenderOptions;
  redirectTimeout: number = PaymentRedirectTimeouts.WECHAT_PAY;
  public declare gatewayHandler: WechatPayHandler;

  constructor(...args) {
    super(...args);
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.WECHAT_PAY,
    });
  }

  setPaymentData(paymentData: PaymentData) {
    this.paymentData = paymentData;
  }

  getPaymentData(): PaymentData {
    return this.paymentData;
  }

  getQrCode(paymentAttempt: any): {} {
    return {};
  }

  public setRenderOptions(options: RenderOptions) {
    this.renderOptions = options;
  }

  public getRenderOptions(): RenderOptions {
    const defaults = {
      heading: 'Scan QR code with WeChat',
      instruction: QrPaymentModalDefaults.instruction,
      timerLabel: 'This QR code is valid for {time}',
      timerDurationSeconds: 10 * 60, // 10 minutes
      waitingMessage: QrPaymentModalDefaults.waitingMessage,
      accentColor: QrPaymentModalDefaults.accentColor,
      buttonText: 'Pay with WeChat App',
    };
    const opts: Partial<RenderOptions> = this.renderOptions || {};
    return {
      heading: opts.heading || defaults.heading,
      instruction: opts.instruction || defaults.instruction,
      timerLabel: opts.timerLabel || defaults.timerLabel,
      timerDurationSeconds:
        opts.timerDurationSeconds != null ? opts.timerDurationSeconds : defaults.timerDurationSeconds,
      waitingMessage: opts.waitingMessage || defaults.waitingMessage,
      accentColor: opts.accentColor || defaults.accentColor,
      buttonText: opts.buttonText || defaults.buttonText,
    };
  }

  handlePayment(options: RenderOptions, callbacks?: Callbacks): Promise<any> {
    return this.getGatewayHandler(this.getPaymentIntent()).then((handler) => {
      this.gatewayHandler = handler as WechatPayHandler;
      this.gatewayHandler.setRenderOptions(options);
      return this.gatewayHandler.initiateAuthorization({}, callbacks);
    });
  }

  private challengeFlow(paymentAttempt: PaymentAttempt): Promise<any> {
    if (this.gatewayHandler && this.gatewayHandler.getPaymentData) {
      this.setPaymentData(this.gatewayHandler.getPaymentData());
    }
    this.renderQR();
    return this.pollForAuthCompletion();
  }

  protected handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_CHALLENGE:
      case PaymentAttemptStatus.REQUIRES_REDIRECTION:
      case PaymentAttemptStatus.PENDING_AUTHORIZATION: {
        return this.challengeFlow(paymentAttempt).then((data) => {
          this.setPaymentIntent(data.payment_intent);
          return this.handlePaymentAttempt(this.getPaymentAttempt());
        });
      }
      case PaymentAttemptStatus.AUTHORIZED: {
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

  renderQR = () => {
    const paymentData = this.getPaymentData();
    this.lightbox = renderQrPaymentModal({
      modalId: 'wechat-pay',
      qrCode: (paymentData && paymentData.qrCode) || '',
      qrAlt: 'WeChat Pay QR Code',
      mobileAppUrl: paymentData && paymentData.qrCodeData,
      renderOptions: this.getRenderOptions(),
      isMobile: Helpers.isMobileOrTablet(),
      onDismiss: () => this.abandonPendingAuthorization(),
    });
  };
}
