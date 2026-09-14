import {PaymentRedirectTimeouts} from '@/constants/enums';
import {PayconiqByBancontactPayment, PaymentOptions} from '@/hosted_fields/common/base-types';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {
  Callbacks,
  PaymentMethodType,
  PaymentAttempt,
  PaymentAttemptStatus,
  PaymentIntent,
} from '@/internal/payment-intent/types';
import {PaymentData, PaymentInfo, RenderInfo} from '../types';
import {CbError} from '@/hosted_fields/common/errors';
import Helpers from '@/helpers';
import {renderQrPaymentModal, QrPaymentModalDefaults} from '@/internal/auth-redirect/qr-payment-modal';

export default class PayconiqByBancontactHandler extends PaymentIntentHandler implements PayconiqByBancontactPayment {
  public paymentData: PaymentData;
  public renderInfo: Partial<RenderInfo>;
  redirectTimeout: number = PaymentRedirectTimeouts.PAYCONIQ_BY_BANCONTACT;

  constructor(...args) {
    super(...args);
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.PAYCONIQ_BY_BANCONTACT,
    });
  }

  setPaymentData(paymentData: PaymentData) {
    this.paymentData = paymentData;
  }

  getPaymentData(): PaymentData {
    return this.paymentData;
  }

  public setRenderInfo(renderInfo?: Partial<RenderInfo>) {
    this.renderInfo = renderInfo || {};
  }

  public getRenderInfo(): RenderInfo {
    const defaults = {
      heading: 'Scan QR code',
      instruction: QrPaymentModalDefaults.instruction,
      timerLabel: 'Approve payment within: {time}',
      timerDurationSeconds: 15 * 60, // 15 minutes
      waitingMessage: QrPaymentModalDefaults.waitingMessage,
      accentColor: QrPaymentModalDefaults.accentColor,
      buttonText: 'Pay with Payconiq App',
    };
    const opts = this.renderInfo || {};
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

  getQrCode(paymentAttempt: any): {} {
    return {};
  }

  async getIntent(options: PaymentOptions): Promise<PaymentIntent> {
    if (options && options.paymentIntent instanceof Function) {
      const paymentIntent = await options.paymentIntent();
      this.setPaymentIntent(paymentIntent);
    }
    return this.getPaymentIntent();
  }

  async handlePayment(options: PaymentInfo | PaymentOptions, callbacks?: Callbacks): Promise<any> {
    const intent = await this.getIntent(options as PaymentOptions);
    const paymentInfo = ((options as PaymentOptions).paymentInfo as PaymentInfo) || (options as PaymentInfo);
    callbacks = (options as PaymentOptions).callbacks || callbacks;
    return this.getGatewayHandler(intent).then((handler: PayconiqByBancontactHandler) => {
      return handler.handlePayment(paymentInfo, callbacks);
    });
  }

  private challengeFlow(paymentAttempt: PaymentAttempt): Promise<any> {
    this.renderQR();
    return this.pollForAuthCompletion();
  }

  handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
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
      default:
        return Promise.reject(new CbError('UNHANDLED_PAYMENT_STATUS'));
    }
  }

  renderQR = () => {
    const paymentData = this.getPaymentData();
    this.lightbox = renderQrPaymentModal({
      modalId: 'payconiq-by-bancontact',
      qrCode: (paymentData && paymentData.qrCode) || '',
      qrAlt: 'Payconiq QR Code',
      mobileAppUrl: paymentData && paymentData.urlIntent,
      renderOptions: this.getRenderInfo(),
      isMobile: Helpers.isMobileOrTablet(),
      onDismiss: () => this.abandonPendingAuthorization(),
    });
  };
}
