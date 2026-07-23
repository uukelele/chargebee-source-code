import {PaymentRedirectTimeouts} from '@/constants/enums';
import {AmazonPayPayment} from '@/hosted_fields/common/base-types';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {PaymentMethodType, PaymentAttemptStatus} from '@/internal/payment-intent/types';
import {Callbacks} from '@/extensions/three_domain_secure/common/types';
import {sendToMasterIframe} from '@/hosted_fields/host/iframe-client-loader';
import {Master as M, Host as H} from '@/hosted_fields/common/enums';
import {PaymentInfo, AmazonButtonOptions} from '../types';
import CbWindowManager from '@/models/cb-window-manager';
import {PAYMENT_AUTH_REDIRECT_WINDOW_NAME} from '@/hosted_fields/common/base-types';
import EnvConstants from '@/constants/environment';
import Helpers from '@/helpers/index';

const DEFAULT_OPTIONS: AmazonButtonOptions = {
  locale: 'en_US',
  buttonColor: 'Gold',
  placement: 'Cart',
  productType: 'PayAndShip',
  chargePermissionType: 'Recurring',
};
let windowManager: CbWindowManager;

export default class AmazonPayHandler extends PaymentIntentHandler implements AmazonPayPayment {
  protected declare paymentInfo: PaymentInfo;
  private shopperDetails: any;
  redirectTimeout: number = PaymentRedirectTimeouts.DEFAULT;

  constructor(...args) {
    super(...args);
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.AMAZON_PAYMENTS,
      customer: this.paymentInfo.customer,
      paymentType: this.paymentInfo.additionalData && this.paymentInfo.additionalData.paymentType,
    });
  }

  validatePaymentInfo(): Promise<boolean> {
    return Promise.resolve(true);
  }

  async mountPaymentButton(id: string, options?: AmazonButtonOptions) {
    this.gatewayHandler = await this.getGatewayHandler(this.getPaymentIntent());
    return this.gatewayHandler.mountPaymentButton(id, {
      ...DEFAULT_OPTIONS,
      ...(options || {}),
    });
  }

  handlePayment(callbacks?: Callbacks): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.gatewayHandler.initCallbacks) {
        try {
          this.gatewayHandler.initCallbacks({}, callbacks);
          resolve('Callbacks initialized successfully');
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error('initCallbacks is not defined on gatewayHandler'));
      }
    });
  }

  handlePaymentAttemptStatus(paymentAttemptStatus: PaymentAttemptStatus) {
    switch (paymentAttemptStatus) {
      case PaymentAttemptStatus.REQUIRES_REDIRECTION:
        this.redirectToResultURL(this.getPaymentIntent().active_payment_attempt);
        return Promise.resolve(this.getPaymentIntent());
      case PaymentAttemptStatus.AUTHORIZED:
        this.setPaymentIntent({
          ...this.getPaymentIntent(),
          payer_info: {...this.shopperDetails},
        });
        this.callbackHandler.triggerSuccessCallback();
        return Promise.resolve(this.getPaymentIntent());
      case PaymentAttemptStatus.REFUSED:
        this.callbackHandler.triggerErrorCallback(this.callbackHandler.intentError());
        return Promise.reject(this.callbackHandler.intentError());
    }
    return this.handlePaymentAttempt(this.getPaymentAttempt());
  }

  mountReviewButtoncall(amazonCheckout: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams(window.location.search);
      const data = {
        paymentIntentId: this.getPaymentIntent().id,
        payload: {
          paymentMethodType: PaymentMethodType.AMAZON_PAYMENTS,
          paymentMethodDetails: {
            tempToken: amazonCheckout.amazonCheckoutSessionId,
          },
        },
      };
      this.confirmPayment(data)
        .then((intent) => {
          const {payer_info = {}} = intent;
          this.shopperDetails = payer_info;
          this.setPaymentIntent(intent);
        })
        .catch((err) => {
          this.callbackHandler.triggerErrorCallback(this.callbackHandler.intentError());
        });
    });
  }

  getshopperInfo() {
    return this.getPaymentIntent() && this.getPaymentIntent().payer_info;
  }

  bindAction(id, amazonCheckoutSessionId, action) {
    window['amazon'].Pay.bindChangeAction(id, {
      amazonCheckoutSessionId: amazonCheckoutSessionId,
      changeAction: action,
    });
  }

  protected confirmPayment(data: any = {}): Promise<any> {
    return sendToMasterIframe(M.Actions.ConfirmPaymentIntent, data, {
      timeout: 120000,
    }).then(this.handleConfirmPaymentResponse);
  }

  setWindowPopup() {
    windowManager = new CbWindowManager();
    this.setWindowManager(windowManager);
  }

  redirectToAmazonPay(data: any): Promise<any> {
    const paymentIntentId = this.getPaymentIntent().id;
    let jsEnv = EnvConstants.ENVIRONMENT;
    let site = Helpers.getCbInstance().options.site;
    const url = new URL(`${EnvConstants.ASSET_PATH}/amazon-pay.html`);
    url.searchParams.set('site', site);
    url.searchParams.set('env', jsEnv);
    if (jsEnv === 'predev' || jsEnv === 'predev1') {
      url.searchParams.set('domain', Helpers.getCbInstance().options.domain);
    }
    windowManager.openDirect(url, PAYMENT_AUTH_REDIRECT_WINDOW_NAME, {
      skipReferrer: true,
      showLoader: true,
      openInNewWindow: true,
    });
    this.windowManager.watchClose(() => this.callbackHandler.triggerCancelCallback());

    setTimeout(() => {
      this.windowManager.window.postMessage(data, '*');
    }, 1000);
    return sendToMasterIframe(
      M.Actions.PollPaymentIntent3DSResult,
      {
        paymentIntentId,
      },
      {
        timeout: this.redirectTimeout,
      }
    ).then((data) => {
      this.mountReviewButtoncall(data);
    });
  }

  public redirectToResultURL(paymentAttempt: any): Promise<any> {
    const rawData = paymentAttempt.action_payload;
    windowManager.loadURL(rawData.redirectUrl);
    return this.pollForAuthCompletion().then(this.handleConfirmPaymentResponse);
  }
}
