import {PaymentRedirectTimeouts} from '@/constants/enums';
import {WechatPayPayment, PAYMENT_AUTH_REDIRECT_WINDOW_NAME} from '@/hosted_fields/common/base-types';
import {CbError} from '@/hosted_fields/common/errors';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {Callbacks, PaymentMethodType, PaymentAttempt, PaymentAttemptStatus} from '@/internal/payment-intent/types';
import CbWindowManager from '@/models/cb-window-manager';
import {PaymentData, RenderOptions} from '../types';
import LightBox from '@/extensions/three_domain_secure/common/lightbox';
import Helpers from '@/helpers';

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
      timerLabel: 'This QR code is valid for {time}',
      timerDurationSeconds: 10 * 60, // 10 minutes
      buttonText: 'Pay with WeChat App',
    };
    const opts: Partial<RenderOptions> = this.renderOptions || {};
    return {
      heading: opts.heading || defaults.heading,
      timerLabel: opts.timerLabel || defaults.timerLabel,
      timerDurationSeconds: opts.timerDurationSeconds || defaults.timerDurationSeconds,
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
        if (this.lightbox) {
          this.lightbox.close();
          this.lightbox.destroy();
        }
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
    this.lightbox = new LightBox('wechat-pay');
    const iframe = this.lightbox.createIframe('wechat-pay-qr-frame');
    this.lightbox.show();
    iframe.style.width = '400px';
    iframe.style.height = '450px';
    iframe.style.minWidth = '400px';
    iframe.style.minHeight = '450px';
    iframe.style.maxWidth = '400px';
    iframe.style.maxHeight = '450px';
    iframe.onload = () => {
      const doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
      const paymentData = this.getPaymentData();
      const qrCode = paymentData && paymentData.qrCode ? paymentData.qrCode : '';
      if (doc && qrCode) {
        doc.open();
        doc.write(this.getQrModalHtml(qrCode, this.getRenderOptions()));
        doc.close();
      }
      this.lightbox.hideLoader();
    };
    iframe.src = 'about:blank';
  };

  private getQrImageHtml(qrCode: string): string {
    return `<img src="${qrCode}" alt="WeChat Pay QR Code" style="max-width:100%;margin-bottom:0;"/>`;
  }

  private getHeadingHtml(heading: string): string {
    return `<div style="font-family: SF Pro Text, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;font-size:20px;color:#21262C;margin-bottom:0;font-weight:600;">${heading}</div>`;
  }

  private getTimerHtml(timerLabel: string): string {
    const labelWithTimer = timerLabel.replace('{time}', '<span id="timer"></span>');
    return `<div id="qr-timer" style="font-family: SF Pro Text, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;font-size:14px;color:#666;margin-bottom:0;">
      ${labelWithTimer}
    </div>`;
  }

  private getTimerScript(timerDurationSeconds: number): string {
    return `<script>
      (function() {
        var duration = ${timerDurationSeconds};
        var display = document.getElementById('timer');
        function startTimer() {
          var timer = duration, minutes, seconds;
          var interval = setInterval(function () {
            minutes = parseInt(timer / 60, 10);
            seconds = parseInt(timer % 60, 10);
            minutes = minutes < 10 ? "0" + minutes : minutes;
            seconds = seconds < 10 ? "0" + seconds : seconds;
            display.textContent = minutes + ":" + seconds;
            if (--timer < 0) {
              clearInterval(interval);
              display.textContent = "00:00";
            }
          }, 1000);
        }
        startTimer();
      })();
    </script>`;
  }

  getQrModalHtml(qrCode: string, renderOptions: RenderOptions): string {
    const paymentData = this.getPaymentData();
    const qrCodeData = paymentData.qrCodeData;
    const isMobile = Helpers.isMobileOrTablet();
    return `
      <html>
      <body style="display:flex;flex-direction:column;align-items:center;justify-content:flex-start;box-sizing:border-box;padding:20px 12px 12px 12px;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;overflow-y:auto;gap:12px;">
        ${isMobile ? this.getMobileButtonHtml(qrCodeData, renderOptions.buttonText) : ''}
        ${isMobile ? this.getOrDividerHtml() : ''}
        ${this.getQrImageHtml(qrCode)}
        ${this.getHeadingHtml(renderOptions.heading)}
        ${this.getTimerHtml(renderOptions.timerLabel)}
        ${this.getTimerScript(renderOptions.timerDurationSeconds)}
      </body>
      </html>
    `;
  }

  private getOrDividerHtml(): string {
    return `
      <div style="display:flex;align-items:center;width:100%;margin:16px 0;">
        <div style="flex:1;height:1px;background:#E0E0E0;"></div>
        <span style="margin:0 12px;color:#888;font-size:14px;">or</span>
        <div style="flex:1;height:1px;background:#E0E0E0;"></div>
      </div>
    `;
  }

  private getMobileButtonHtml(qrCodeData: string, buttonText: string): string {
    if (!qrCodeData) return '';
    return `
      <a href="${qrCodeData}" target="_blank" rel="noopener" 
        style="display:inline-block;margin:16px 0;padding:12px 24px;background:#09BB07;color:#fff;font-size:16px;border-radius:8px;text-decoration:none;min-width:220px;max-width:90%;text-align:center;box-sizing:border-box;white-space:normal;word-break:break-word;">
        ${buttonText}
      </a>
    `;
  }
}
