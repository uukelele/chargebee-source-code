import {
  Callbacks,
  PaymentAttempt,
  PaymentAttemptStatus,
  PaymentIntentResponse,
  PaymentMethodType,
} from '@/extensions/three_domain_secure/common/types';
import {loadScriptUsingPredicate} from '@/extensions/three_domain_secure/common/utils';
import {CbError} from '@/hosted_fields/common/errors';
import UpiHandler from '@/plugins/payments/upi/handlers';
import {getRazorPay} from '@/utils/payments/razorpay';
import {PaymentInfo} from '@/plugins/payments/upi/types';
import {PaymentOptions} from '@/hosted_fields/common/base-types';
import {PaymentData, RenderOptions} from '../../payconiq_by_bancontact/types';
import Helpers from '@/helpers';
import {PaymentRedirectTimeouts} from '@/constants/enums';
import EnvConstants from '@/constants/environment';
import {DetectResult} from '@/utils/browser/types';
import {detect} from '@/utils/browser';
// import {OS} from '@/utils/browser/constants';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import {jsonify} from '@/utils/utility-functions';
import {Master as M} from '@/hosted_fields/common/enums';
import Ids from '@/constants/ids';
import * as QRCode from 'qrcode';

export default class RazorpayUpiHandler extends UpiHandler {
  private razorpay: any;
  public paymentData: PaymentData;
  public renderOptions: RenderOptions;
  redirectTimeout: number = PaymentRedirectTimeouts.UPI;
  selectedApp: string | null = null;
  browserInfo: DetectResult = detect();

  constructor(handler: UpiHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
  }

  getPaymentData(): any {
    const paymentData = {
      amount: this.getPaymentIntent().amount, // amount in paise
      method: 'upi',
      contact: (this.paymentInfo.customer && this.paymentInfo.customer.phone) || '',
      email: (this.paymentInfo.customer && this.paymentInfo.customer.email) || '',
      customer_id: this.getPaymentAttempt().action_payload.customer_id,
      order_id: this.getPaymentAttempt().action_payload.order_id,
      ...((!this.paymentInfo.additionalData ||
        (this.paymentInfo.additionalData && this.paymentInfo.additionalData.paymentType != 'ONETIME')) && {
        recurring: 1,
      }),
      ...((!this.paymentInfo.additionalData ||
        (this.paymentInfo.additionalData && this.paymentInfo.additionalData.paymentType != 'ONETIME')) && {save: 1}),
    };
    const paymentAttemptPayload = this.getPaymentAttempt().action_payload;
    if (paymentAttemptPayload && paymentAttemptPayload.order_receipt) {
      paymentData['notes'] = {
        invoice_number: paymentAttemptPayload.order_receipt,
      };
    }
    return paymentData;
  }

  protected kvl(data): Promise<any> {
    const payload = {
      ...jsonify(data),
    };
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.CaptureKVL,
          data: payload,
        },
        Ids.MASTER_FRAME
      )
    );
  }

  private loadRazorPayJS(): Promise<any> {
    return loadScriptUsingPredicate('https://checkout.razorpay.com/v1/razorpay.js', () => !!getRazorPay());
  }

  async fetchUpiInstalledAppList(gatewayCredentials?: any): Promise<any> {
    // Get gatewayCredentials from parameter, base class property, or fetch it
    if (gatewayCredentials) {
      this.gatewayCredentials = gatewayCredentials;
    } else if (!this.gatewayCredentials) {
      const [credentials] = await Promise.all([this.fetchGatewayCredential()]);
      this.gatewayCredentials = credentials;
    }

    if (!this.razorpay) {
      const [_] = await Promise.all([this.loadRazorPayJS()]);
      this.razorpay = this.createRazorPayInstance(this.gatewayCredentials);

      if (!this.razorpay) {
        throw new CbError('Failed to initialize Razorpay instance');
      }
    }

    // Get array of app IDs from Razorpay
    const appIds = await this.razorpay.getSupportedUpiIntentApps();
    let installedApps = [];
    this.kvl({
      flow: 'upi_intent_flow',
      action: 'get_supported_upi_intent_apps',
      device_os_name: this.browserInfo.os.name,
      gateway: 'Razorpay',
      app_ids: appIds,
    });

    // if (this.browserInfo.os.name === OS.ANDROID) {
    //   installedApps = await this.checkInstalledApps(appIds);
    // } else {
    installedApps = appIds;
    // }

    return installedApps.map((appId: string) => {
      const appInfo = this.getAppDisplayInfo(appId);
      return {
        name: appInfo.name,
        id: appId,
      };
    });
  }

  private createRazorPayInstance(gatewayCredentials: any): any {
    const Razorpay = getRazorPay();
    if (!Razorpay) {
      return null;
    }
    const keyId = gatewayCredentials && gatewayCredentials.key_id;
    if (!keyId) {
      return null;
    }
    const options: any = {key: keyId};
    if (gatewayCredentials.account_id) {
      options.account_id = gatewayCredentials.account_id;
    }
    return new Razorpay(options);
  }

  private getAppIconFileName(app: string): string {
    // Map Razorpay app codes to icon file names
    const iconFileMap: Record<string, string> = {
      gpay: 'google-pay',
      phonepe: 'phone-pe',
      paytm: 'paytm',
      cred: 'cred',
      bhim: 'bhim',
      popclubapp: 'pop_club_app',
      mobikwik: 'mobikwik',
      super_money: 'super_money',
      moneyview: 'money_view',
      icici: 'icici',
      navi: 'navi',
      payzapp: 'pay_zapp',
      jupiter: 'jupiter',
      amazon: 'amazon',
      any: 'bhim', // Fallback to BHIM for generic UPI
    };

    return iconFileMap[app] || 'bhim';
  }

  private createAppIconImg(app: string, iframeDoc: Document): HTMLImageElement {
    const iconName = this.getAppIconFileName(app);
    // Construct full asset URL - use same pattern as card-templates but with full path for iframe
    const img = iframeDoc.createElement('img');
    // Use JS_DOMAIN (which is the same as where assets are served) to construct the full URL
    // This matches the pattern used in card-templates.ts but with absolute path for iframe context
    const assetBaseUrl = EnvConstants.JS_DOMAIN || window.location.origin;
    img.src = `${assetBaseUrl}/v2/assets/${iconName}.svg`;
    img.alt = app;
    img.id = `UpiAppIcon-${app}`;
    return img;
  }

  private getAppDisplayInfo(app: string): {name: string; color: string} {
    const appInfo: Record<string, {name: string; color: string}> = {
      gpay: {name: 'Google Pay', color: '#4285F4'},
      phonepe: {name: 'PhonePe', color: '#5F259F'},
      paytm: {name: 'Paytm', color: '#00BAF2'},
      cred: {name: 'CRED', color: '#00D9FF'},
      bhim: {name: 'BHIM UPI', color: '#FF6B35'},
      popclubapp: {name: 'Popclub', color: '#FF6B9D'},
      mobikwik: {name: 'MobiKwik', color: '#FF6B00'},
      super_money: {name: 'Super Money', color: '#8B5CF6'},
      moneyview: {name: 'MoneyView', color: '#10B981'},
      icici: {name: 'ICICI Bank', color: '#FF6B00'},
      navi: {name: 'Navi', color: '#3B82F6'},
      payzapp: {name: 'PayZapp', color: '#FF6B00'},
      jupiter: {name: 'Jupiter', color: '#E36E64'},
      amazon: {name: 'Amazon Pay', color: '#FF9900'},
      any: {name: 'Other UPI Apps', color: '#6B7280'},
    };

    const info = appInfo[app] || {
      name: app.charAt(0).toUpperCase() + app.slice(1),
      color: '#6B7280',
    };

    return {
      name: info.name,
      color: info.color,
    };
  }

  // private async isUpiAppAvailable(app: string): Promise<boolean> {
  //   if (app !== 'gpay') {
  //     return true;
  //   }
  //   try {
  //     await this.razorpay.checkPaymentAdapter(app);
  //     return true;
  //   } catch (error) {
  //     this.kvl({
  //       flow: 'upi_intent_flow',
  //       action: 'check_payment_adapter_error',
  //       device_os_name: this.browserInfo.os.name,
  //       gateway: 'Razorpay',
  //       app: app,
  //       error: error && error.message,
  //       error_code: error && error.code,
  //     });
  //     return false;
  //   }
  // }

  // private async checkInstalledApps(apps: string[]): Promise<string[]> {
  //   const availability = await Promise.all(apps.map((app) => this.isUpiAppAvailable(app)));
  //   return apps.filter((_, i) => availability[i]);
  // }

  private hasChallengeCallback(): boolean {
    return !!(this.callbackHandler && this.callbackHandler.callbacks && this.callbackHandler.callbacks.challenge);
  }

  private async getQrCodeImageUrl(qrData: string): Promise<string> {
    if (/^https?:\/\//i.test(qrData)) {
      return qrData;
    }
    return QRCode.toDataURL(qrData, {width: 240, margin: 2, errorCorrectionLevel: 'M'});
  }

  private getQrExpirySeconds(expiresOn?: number): number {
    if (!expiresOn) {
      return 10 * 60;
    }
    return Math.max(Math.floor((expiresOn - Date.now()) / 1000), 0);
  }

  private async showQrInIframe(qrUrl: string, expiresOn?: number): Promise<void> {
    let qrImageUrl: string;
    try {
      qrImageUrl = await this.getQrCodeImageUrl(qrUrl);
    } catch (error) {
      this.callbackHandler.triggerErrorCallback(new CbError('Failed to generate QR code'));
      return;
    }
    if (!qrImageUrl) {
      this.callbackHandler.triggerErrorCallback(new CbError('QR image URL is missing or invalid'));
      return;
    }

    const iframe = this.createIframe(this.getPaymentIntent().gateway);
    this.openIframe();

    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    const timerDurationSeconds = this.getQrExpirySeconds(expiresOn);

    const style = iframeDoc.createElement('style');
    style.textContent = `
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        padding: 24px 16px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        background: #f5f5f5;
        min-height: 100vh;
        display: flex;
        align-items: flex-start;
        justify-content: center;
      }
      .container {
        background: white;
        border-radius: 12px;
        padding: 24px 20px;
        max-width: 360px;
        width: 100%;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
      }
      .heading {
        font-size: 18px;
        font-weight: 600;
        color: #1f2937;
        text-align: center;
      }
      .qr-image {
        width: 240px;
        height: 240px;
        object-fit: contain;
      }
      .timer {
        font-size: 14px;
        color: #6b7280;
        text-align: center;
      }
    `;
    iframeDoc.head.appendChild(style);

    const container = iframeDoc.createElement('div');
    container.className = 'container';

    const heading = iframeDoc.createElement('div');
    heading.className = 'heading';
    heading.textContent = 'Scan QR code with any UPI app';
    container.appendChild(heading);

    const qrImage = iframeDoc.createElement('img');
    qrImage.className = 'qr-image';
    qrImage.src = qrImageUrl;
    qrImage.alt = 'UPI QR Code';
    container.appendChild(qrImage);

    const timer = iframeDoc.createElement('div');
    timer.className = 'timer';
    timer.innerHTML = `This QR code is valid for <span id="timer"></span>`;
    container.appendChild(timer);

    const script = iframeDoc.createElement('script');
    script.textContent = `
      (function() {
        var duration = ${timerDurationSeconds};
        var display = document.getElementById('timer');
        if (!display) return;
        var timer = duration;
        var interval = setInterval(function () {
          var minutes = parseInt(timer / 60, 10);
          var seconds = parseInt(timer % 60, 10);
          minutes = minutes < 10 ? '0' + minutes : minutes;
          seconds = seconds < 10 ? '0' + seconds : seconds;
          display.textContent = minutes + ':' + seconds;
          if (--timer < 0) {
            clearInterval(interval);
            display.textContent = '00:00';
          }
        }, 1000);
      })();
    `;
    iframeDoc.body.appendChild(container);
    iframeDoc.body.appendChild(script);
    this.hideIframeLoader();
  }

  private getQrDirectPaymentData(): any {
    const paymentData = this.getPaymentData();
    return {
      amount: paymentData.amount,
      currency: this.getPaymentIntent().currency_code,
      method: 'upi',
      '_[flow]': 'intent',
      '_[upiqr]': '1',
      email: paymentData.email,
      contact: paymentData.contact,
      customer_id: paymentData.customer_id,
      order_id: paymentData.order_id,
      ...(paymentData.recurring && {recurring: paymentData.recurring}),
      ...(paymentData.save && {save: paymentData.save}),
      ...(paymentData.notes && {notes: paymentData.notes}),
    };
  }

  private registerUpiQrEventHandlers(): void {
    const handler = (data: {qr_url?: string; expires_on?: number; status?: string}) => {
      this.handleUpiQrEvent(data);
    };
    this.razorpay.on('upi.qr', handler);
    this.razorpay.on('payment.upi.qr', handler);
  }

  private startQrDirectPayment(paymentData: any): void {
    this.razorpay.once('ready', (response: any) => {
      this.kvl({
        flow: 'intent_qr_flow',
        action: 'razorpay_ready',
        gateway: 'Razorpay',
        upi_qr_non_redirect_flow: response && response.features && response.features.upi_qr_non_redirect_flow,
      });
      this.razorpay.createPayment(paymentData, {
        flow: 'qr',
        app: 'any',
      });
    });
  }

  private handleUpiQrEvent(data: {qr_url?: string; expires_on?: number; status?: string}): void {
    if (data.status === 'created' && data.qr_url) {
      if (this.hasChallengeCallback()) {
        this.callbackHandler.triggerChallengeCallback({
          qr_url: data.qr_url,
          expires_on: data.expires_on,
        });
      } else {
        this.showQrInIframe(data.qr_url, data.expires_on);
      }
      return;
    }

    const cbError = new CbError('QR expired');
    this.callbackHandler.triggerErrorCallback(cbError);
  }

  private showUpiAppsInIframe(apps: string[]): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        // Check which apps are installed

        // Create iframe for showing UPI apps
        const iframe = this.createIframe(this.getPaymentIntent().gateway);
        this.openIframe();

        // Create a container div inside the iframe to show app list
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

        // Add styles to the document head
        const style = iframeDoc.createElement('style');
        style.textContent = `
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #f5f5f5;
            min-height: 100vh;
            display: flex;
            align-items: flex-start;
            justify-content: center;
            padding-top: 20px;
          }
          .container {
            background: white;
            border-radius: 12px;
            padding: 0;
            max-width: 420px;
            width: 90%;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            overflow: hidden;
          }
          .section-header {
            padding: 16px;
            border-bottom: 1px solid #e5e7eb;
            background: white;
          }
          .section-title {
          font-size: 16px;
            font-weight: 600;
            color: #1f2937;
          }
          .app-list {
            display: flex;
            flex-direction: column;
          }
          .app-button {
            display: flex;
            align-items: center;
            padding: 16px;
            border: none;
            border-bottom: 1px dashed #e5e7eb;
          background: white;
          cursor: pointer;
            transition: background 0.2s ease;
            text-align: left;
            width: 100%;
            font-size: 16px;
            font-weight: 400;
            color: #1f2937;
            position: relative;
          }
          .app-button:last-of-type {
            border-bottom: none;
          }
          .app-button.selected {
            border-bottom: none !important;
            background: white;
          }
          .app-button.selected + .pay-button-container {
            border-top: none;
          }
          .pay-button-container + .app-button {
            border-top: 1px dashed #e5e7eb;
          }
          .app-button:hover {
            background: #f9fafb;
          }
          .app-button:active {
            background: #f3f4f6;
          }
          .app-icon {
            margin-right: 16px;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            flex-shrink: 0;
            overflow: hidden;
            background: white;
          }
          .app-icon img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
          .app-name {
            flex: 1;
            font-size: 16px;
            color: #1f2937;
          }
          .selection-indicator {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border: 2px solid #d1d5db;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-left: auto;
            flex-shrink: 0;
            transition: all 0.2s ease;
            background: white;
          }
          .app-button.selected .selection-indicator {
            border-color: #10b981;
            background: #10b981;
          }
          .selection-indicator svg {
            width: 12px;
            height: 12px;
            fill: white;
            display: none;
          }
          .app-button.selected .selection-indicator svg {
            display: block;
          }
          .pay-button-container {
            padding: 12px 16px;
            border-top: none;
            border-bottom: 1px dashed #e5e7eb;
            display: none;
            background: white;
          }
          .pay-button-container.visible {
            display: block;
            border-bottom: 1px dashed #e5e7eb;
          }
          .pay-button {
            width: 100%;
            padding: 12px 24px;
            background: #10b981;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s ease, transform 0.1s ease, opacity 0.2s ease;
            text-align: center;
          }
          .pay-button:hover {
            opacity: 0.95;
          }
          .pay-button:active {
            transform: scale(0.98);
            opacity: 0.9;
          }
        `;
        iframeDoc.head.appendChild(style);

        const container = iframeDoc.createElement('div');
        container.className = 'container';

        // Add section header "UPI Pay by any UPI App" as a single title
        const sectionHeader = iframeDoc.createElement('div');
        sectionHeader.className = 'section-header';
        const sectionTitle = iframeDoc.createElement('div');
        sectionTitle.className = 'section-title';
        sectionTitle.textContent = 'UPI Pay by any UPI App';
        sectionHeader.appendChild(sectionTitle);
        container.appendChild(sectionHeader);

        const appList = iframeDoc.createElement('div');
        appList.className = 'app-list';

        let selectedApp: string | null = null;
        let selectedAppInfo: {name: string; color: string} | null = null;
        let currentPayButtonContainer: HTMLElement | null = null;

        // Create checkmark SVG
        const checkmarkSvg = `
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor"/>
          </svg>
        `;

        apps.forEach((app, index) => {
          const appInfo = this.getAppDisplayInfo(app);
          const appButton = iframeDoc.createElement('button');
          appButton.className = 'app-button';
          appButton.setAttribute('data-app', app);

          const iconContainer = iframeDoc.createElement('div');
          iconContainer.className = 'app-icon';
          // Create img element directly like card icons
          const iconImg = this.createAppIconImg(app, iframeDoc);
          iconContainer.appendChild(iconImg);
          appButton.appendChild(iconContainer);

          const nameSpan = iframeDoc.createElement('span');
          nameSpan.className = 'app-name';
          nameSpan.textContent = appInfo.name;
          appButton.appendChild(nameSpan);

          // Add selection indicator (radio button/checkmark)
          const selectionIndicator = iframeDoc.createElement('div');
          selectionIndicator.className = 'selection-indicator';
          selectionIndicator.innerHTML = checkmarkSvg;
          appButton.appendChild(selectionIndicator);

          appButton.addEventListener('click', () => {
            // Remove selected class from all buttons
            const allButtons = iframeDoc.querySelectorAll('.app-button');
            allButtons.forEach((btn) => {
              btn.classList.remove('selected');
              const indicator = btn.querySelector('.selection-indicator') as HTMLElement;
              if (indicator) {
                indicator.style.background = 'white';
                indicator.style.borderColor = '#d1d5db';
              }
            });

            // Remove existing pay button if any
            if (currentPayButtonContainer && currentPayButtonContainer.parentNode) {
              currentPayButtonContainer.parentNode.removeChild(currentPayButtonContainer);
              currentPayButtonContainer = null;
            }

            // Add selected class to clicked button
            appButton.classList.add('selected');
            selectedApp = app;
            selectedAppInfo = appInfo;

            // Update selection indicator color
            const selectionIndicator = appButton.querySelector('.selection-indicator') as HTMLElement;
            if (selectionIndicator) {
              const appColor = appInfo.color || '#10b981';
              selectionIndicator.style.background = appColor;
              selectionIndicator.style.borderColor = appColor;
            }

            // Create pay button container and insert it right after the selected app button
            const payButtonContainer = iframeDoc.createElement('div');
            payButtonContainer.className = 'pay-button-container visible';
            const payButton = iframeDoc.createElement('button');
            payButton.className = 'pay-button';
            payButton.textContent = `Pay via ${appInfo.name}`;
            const appColor = appInfo.color || '#10b981';
            payButton.style.background = appColor;
            payButtonContainer.appendChild(payButton);

            // Insert pay button container right after the selected app button
            appButton.parentNode.insertBefore(payButtonContainer, appButton.nextSibling);
            currentPayButtonContainer = payButtonContainer;

            // Pay button click handler
            payButton.addEventListener('click', (e) => {
              e.stopPropagation();
              if (selectedApp) {
                this.selectedApp = selectedApp;
                this.removeIframe();
                resolve(selectedApp);
              }
            });
          });

          appList.appendChild(appButton);
        });

        container.appendChild(appList);
        iframeDoc.body.appendChild(container);
      } catch (error) {
        const cbError = error instanceof CbError ? error : new CbError(error);
        this.callbackHandler.triggerErrorCallback(cbError);
        return;
      }
    });
  }

  private createPaymentWithApp(app: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const paymentData = this.getPaymentData();

      // Set up event handlers before creating payment
      this.razorpay.on('payment.success', (response: any) => {
        this.kvl({
          flow: 'app_flow',
          action: 'payment.success',
          device_os_name: this.browserInfo && this.browserInfo.os ? this.browserInfo.os.name : '',
          upi_app: app,
          gateway: 'Razorpay',
          response: JSON.stringify(response),
        });
        return Promise.resolve(
          this.confirmPayment({
            paymentMethodType: 'upi',
            paymentMethod: {id: response.razorpay_payment_id},
          }).catch((err) => {
            if (
              err &&
              (err.message === 'Payment intent is authorized' || err.message === 'Payment intent is consumed')
            ) {
              this.kvl({
                fallback: 'razorpay_app_retrieve_completion_fallback',
              });
              return retrievePaymentIntent(this.getPaymentIntent().id).then((data: any) => {
                this.setPaymentIntent(data.payment_intent);
                return this.handlePaymentAttempt(this.getPaymentAttempt());
              });
            }
            throw new CbError(err);
          })
        );
      });

      this.razorpay.on('payment.error', (error: any) => {
        this.kvl({
          flow: 'app_flow',
          action: 'payment.error',
          device_os_name: this.browserInfo && this.browserInfo.os ? this.browserInfo.os.name : '',
          upi_app: app,
          gateway: 'Razorpay',
          error: JSON.stringify(error),
        });
        const cbError = error instanceof CbError ? error : new CbError(error);
        this.callbackHandler.triggerErrorCallback(cbError);
        return Promise.reject(cbError);
      });

      // Create payment with selected app
      this.razorpay.createPayment(paymentData, {app});
    });
  }

  private createPaymentWithQR(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const isQrDirectFlow = this.gatewayCredentials && this.gatewayCredentials.intent_qr_flow === true;
      if (isQrDirectFlow) {
        this.registerUpiQrEventHandlers();
      }

      // Set up event handlers before creating payment
      this.razorpay.on('payment.success', (response: any) => {
        if (this.isIframeOpen) {
          this.removeIframe();
        }
        this.kvl({
          flow: 'qr_flow',
          action: 'payment.success',
          gateway: 'Razorpay',
          response: JSON.stringify(response),
        });
        return Promise.resolve(
          this.confirmPayment({
            paymentMethodType: 'upi',
            paymentMethod: {id: response.razorpay_payment_id},
          }).catch((err) => {
            if (
              err &&
              (err.message === 'Payment intent is authorized' || err.message === 'Payment intent is consumed')
            ) {
              this.kvl({
                fallback: 'razorpay_qr_retrieve_completion_fallback',
              });
              return retrievePaymentIntent(this.getPaymentIntent().id).then((data: any) => {
                this.setPaymentIntent(data.payment_intent);
                return this.handlePaymentAttempt(this.getPaymentAttempt());
              });
            }
            throw new CbError(err);
          })
        );
      });

      this.razorpay.on('payment.error', (error: any) => {
        if (this.isIframeOpen) {
          this.removeIframe();
        }
        this.kvl({
          flow: 'qr_flow',
          action: 'payment.error',
          gateway: 'Razorpay',
          error: JSON.stringify(error),
        });
        const cbError = error instanceof CbError ? error : new CbError(error);
        this.callbackHandler.triggerErrorCallback(cbError);
        return Promise.reject(cbError);
      });

      // Create payment with QR flow
      if (isQrDirectFlow) {
        this.startQrDirectPayment(this.getQrDirectPaymentData());
      } else {
        this.razorpay.createPayment({
          ...this.getPaymentData(),
          upi: {
            qr: true,
            timeout: 10,
          },
        });
      }
    });
  }

  async handlePayment(options: PaymentOptions | any): Promise<any> {
    const paymentInfo = options.paymentInfo as PaymentInfo;
    const callbacks = options.callbacks as Callbacks;
    this.initCallbacks(paymentInfo, callbacks);
    this.paymentInfo = paymentInfo;
    if (options.gatewayCredentials) {
      this.gatewayCredentials = options.gatewayCredentials;
    }
    this.kvl({
      flow: 'upi_intent_flow',
      gateway: 'Razorpay',
    });
    const [_] = await Promise.all([this.loadRazorPayJS()]);
    this.razorpay = this.createRazorPayInstance(options.gatewayCredentials);
    if (!this.razorpay) {
      throw new CbError('Failed to initialize Razorpay instance');
    }
    return await this.initiateAuthorization(paymentInfo, callbacks);
  }

  async handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    const payload = paymentAttempt.action_payload;
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_CHALLENGE: {
        if (Helpers.isMobileOrTablet()) {
          // Get supported UPI apps
          const supportedApps = await this.razorpay.getSupportedUpiIntentApps();

          if (!supportedApps || supportedApps.length === 0) {
            this.kvl({
              action: 'upi_mobile_payment_config',
              device_os_name: this.browserInfo.os.name,
              upi_app: 'upi_apps_not_available',
              gateway: 'Razorpay',
            });
            return this.createPaymentWithQR();
          }
          let selectedApp = this.paymentInfo.upi_app;
          if (!selectedApp || !supportedApps.includes(selectedApp)) {
            // Show app selection in iframe
            let installedApps = [];
            // To-do: Add logic to check installed apps on android platforms
            // For the other apps, the flow will still result in an error if the app is not installed. So until they extend support for installed-app detection to other apps as well, I don't think we need to implement this on our side.
            // if (this.browserInfo.os.name === OS.ANDROID) {
            //   installedApps = await this.checkInstalledApps(supportedApps);
            // } else {
            installedApps = supportedApps;
            // }

            if (installedApps.length === 0) {
              this.kvl({
                action: 'upi_mobile_payment_config',
                device_os_name: this.browserInfo.os.name,
                upi_app: 'upi_apps_not_installed',
                gateway: 'Razorpay',
              });
              return this.createPaymentWithQR();
            }
            selectedApp = await this.showUpiAppsInIframe(installedApps);
          }

          // Create payment with selected app
          return this.createPaymentWithApp(selectedApp);
        } else {
          // Desktop/other devices - show QR code
          return this.createPaymentWithQR();
        }
      }
      case PaymentAttemptStatus.AUTHORIZED: {
        if (this.isIframeOpen) {
          this.removeIframe();
        }
        this.callbackHandler.triggerSuccessCallback();
        return Promise.resolve(this.getPaymentIntent());
      }
      default:
        if (this.isIframeOpen) {
          this.removeIframe();
        }
        return Promise.reject(new CbError('UNHANDLED_PAYMENT_STATUS'));
    }
  }
}

export function retrievePaymentIntent(paymentIntentId: string): Promise<PaymentIntentResponse> {
  return IframeClientLoader.then((cbIframeClient) =>
    cbIframeClient.send(
      {
        action: M.Actions.RetrievePaymentIntent,
        data: {
          paymentIntentId,
        },
      },
      Ids.MASTER_FRAME,
      {timeout: 10000}
    )
  );
}
