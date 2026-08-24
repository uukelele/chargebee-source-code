import {PaymentRedirectTimeouts} from '@/constants/enums';
import {CashAppPayPayment} from '@/hosted_fields/common/base-types';
import {CbError} from '@/hosted_fields/common/errors';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {Callbacks, PaymentMethodType, PaymentAttempt, PaymentAttemptStatus} from '@/internal/payment-intent/types';
import {PaymentData, RenderOptions} from '../types';
import Helpers from '@/helpers';
import {renderQrPaymentModal, QrPaymentModalDefaults} from '@/internal/auth-redirect/qr-payment-modal';

export default class CashAppPayHandler extends PaymentIntentHandler implements CashAppPayPayment {
  public paymentData: PaymentData;
  public renderOptions: RenderOptions;
  redirectTimeout: number = PaymentRedirectTimeouts.CASH_APP_PAY;
  public declare gatewayHandler: CashAppPayHandler;

  constructor(...args) {
    super(...args);
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.CASH_APP_PAY,
    });
  }

  setPaymentData(paymentData: PaymentData) {
    this.paymentData = paymentData;
  }

  getPaymentData(): PaymentData {
    return this.paymentData;
  }

  public setRenderOptions(options: RenderOptions) {
    this.renderOptions = options;
  }

  public getRenderOptions(): RenderOptions {
    const defaults = {
      heading: 'Scan QR code with Cash App',
      instruction: QrPaymentModalDefaults.instruction,
      timerLabel: 'This QR code is valid for {time}',
      timerDurationSeconds: 60 * 60,
      waitingMessage: QrPaymentModalDefaults.waitingMessage,
      accentColor: QrPaymentModalDefaults.accentColor,
      buttonText: 'Pay with Cash App',
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

  getQrCode(paymentAttempt: any): {} {
    return {};
  }

  handlePayment(options: RenderOptions, callbacks?: Callbacks): Promise<any> {
    return this.getGatewayHandler(this.getPaymentIntent()).then((handler) => {
      this.gatewayHandler = handler as CashAppPayHandler;
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
      case PaymentAttemptStatus.REQUIRES_REDIRECTION:
      case PaymentAttemptStatus.REQUIRES_CHALLENGE: {
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
      modalId: 'cash-app-pay',
      qrCode: (paymentData && paymentData.qrCode) || '',
      qrAlt: 'Cash App Pay QR Code',
      mobileAppUrl: paymentData && paymentData.mobileAuthUrl,
      renderOptions: this.getRenderOptions(),
      isMobile: Helpers.isMobileOrTablet(),
      onDismiss: () => this.abandonPendingAuthorization(),
    });
  };
}
