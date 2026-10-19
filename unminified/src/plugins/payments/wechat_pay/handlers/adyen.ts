import {PaymentAttempt, PaymentMethodType} from '@/internal/payment-intent/types';
import {PAYMENT_AUTH_REDIRECT_WINDOW_NAME} from '@/hosted_fields/common/base-types';
import CbWindowManager from '@/models/cb-window-manager';
import WechatPayHandler from './index';
import {createAdyenInstance, adyenHandlePaymentAttempt} from '@/utils/payments/adyen';

export default class AdyenWechatPayHandler extends WechatPayHandler {
  private adyenClient: any;

  constructor(handler: WechatPayHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  async initPayment(): Promise<any> {
    await this.openRedirectWindow();

    // 1. Create Adyen checkout instance; store for handleAdyenAction
    this.adyenClient = await createAdyenInstance(this.getPaymentIntent(), this);

    // Build and return confirm payload for WeChat Pay
    let payload: any = {
      paymentMethodType: PaymentMethodType.WECHAT_PAY,
    };

    if (this.paymentInfo.customer) {
      payload['paymentMethodDetails'] = {
        firstName: this.paymentInfo.customer.firstName,
        lastName: this.paymentInfo.customer.lastName,
        email: this.paymentInfo.customer.email,
        phone: this.paymentInfo.customer.phone,
      };
      if (this.paymentInfo.customer.billingAddress) {
        payload['paymentMethodDetails']['billingAddress'] = this.paymentInfo.customer.billingAddress;
      }
    }

    return Promise.resolve(payload);
  }

  async handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    // 2. handleAdyenAction (via adyenHandlePaymentAttempt) — mounts 3DS challenge, resolves, confirms
    return adyenHandlePaymentAttempt(paymentAttempt, this, this.adyenClient).then((data) => {
      const {payment_intent: paymentIntent} = data || {};
      if (paymentIntent) {
        this.setPaymentIntent(data.payment_intent);
      }
      return data;
    });
  }

  // Adyen's return page reports the result only to `window.opener`, so the redirect must run in a popup.
  // Hosted checkout calls this handler directly and does not set enablePopupConsentOverlay, so force it
  // on: a blocked window then shows "Continue to payment" instead of failing the checkout.
  private async openRedirectWindow(): Promise<void> {
    this.windowManager = new CbWindowManager();
    await this.windowManager.openDirectWithConsent('', PAYMENT_AUTH_REDIRECT_WINDOW_NAME, {
      skipReferrer: true,
      showLoader: true,
      openInNewWindow: true,
      enablePopupConsentOverlay: true,
    });
  }
}
