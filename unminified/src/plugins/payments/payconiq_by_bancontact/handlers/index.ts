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
import {PaymentData, RenderOptions} from '../types';
import LightBox from '@/extensions/three_domain_secure/common/lightbox';
import {CbError} from '@/hosted_fields/common/errors';
import Helpers from '@/helpers';

export default class PayconiqByBancontactHandler extends PaymentIntentHandler implements PayconiqByBancontactPayment {
  public paymentData: PaymentData;
  public renderOptions: RenderOptions;
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

  public setRenderOptions(options: RenderOptions) {
    this.renderOptions = options;
  }

  public getRenderOptions(): RenderOptions {
    const defaults = {
      heading: 'Scan QR code',
      timerLabel: 'This QR code is valid for {time}',
      timerDurationSeconds: 15 * 60, // 15 minutes
      buttonText: 'Pay with Payconiq App',
    };
    const opts: Partial<RenderOptions> = this.renderOptions || {};
    return {
      heading: opts.heading || defaults.heading,
      timerLabel: opts.timerLabel || defaults.timerLabel,
      timerDurationSeconds: opts.timerDurationSeconds || defaults.timerDurationSeconds,
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

  async handlePayment(options: RenderOptions | PaymentOptions, callbacks?: Callbacks): Promise<any> {
    const intent = await this.getIntent(options as PaymentOptions);
    return this.getGatewayHandler(intent).then((handler: PayconiqByBancontactHandler) => {
      return handler.handlePayment(options, callbacks);
    });
  }

  private challengeFlow(paymentAttempt: PaymentAttempt): Promise<any> {
    this.renderQR();
    return this.pollForAuthCompletion();
  }

  handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    const payload = paymentAttempt.action_payload;
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
    this.lightbox = new LightBox('payconiq-by-bancontact');
    const iframe = this.lightbox.createIframe('payconiq-by-bancontact-qr-frame');
    this.lightbox.show();
    iframe.style.width = '400px';
    iframe.style.height = '400px';
    iframe.style.minWidth = '400px';
    iframe.style.minHeight = '400px';
    iframe.style.maxWidth = '400px';
    iframe.style.maxHeight = '400px';
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
    return `<img src="${qrCode}" alt="Payconiq QR Code" style="max-width:100%;margin-bottom:0;"/>`;
  }

  private getHeadingHtml(heading: string): string {
    return `<div style="font-family: SF Pro Text;font-size:20px;color:#21262C;margin-bottom:0;">${heading}</div>`;
  }

  private getTimerHtml(timerLabel: string): string {
    const labelWithTimer = timerLabel.replace('{time}', '<span id="timer"></span>');
    return `<div id="qr-timer" style="font-family: SF Pro Text;font-size:14px;color:#21262C;margin-bottom:0;">
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
    const urlIntent = paymentData.urlIntent;
    const isMobile = Helpers.isMobileOrTablet();
    return `
      <html>
      <body style="display:flex;flex-direction:column;align-items:center;justify-content:flex-start;box-sizing:border-box;padding:20px 12px 12px 12px;font-family:sans-serif;overflow-y:auto;gap:12px;">
        ${isMobile ? this.getMobileButtonHtml(urlIntent, renderOptions.buttonText) : ''}
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

  private getMobileButtonHtml(urlIntent: string, buttonText: string): string {
    if (!urlIntent) return '';
    return `
      <a href="${urlIntent}" target="_blank" rel="noopener" 
        style="display:inline-block;margin:16px 0;padding:12px 24px;background:#01264B;color:#fff;font-size:16px;border-radius:8px;text-decoration:none;min-width:220px;max-width:90%;text-align:center;box-sizing:border-box;white-space:normal;word-break:break-word;">
        ${buttonText}
      </a>
    `;
  }
}
