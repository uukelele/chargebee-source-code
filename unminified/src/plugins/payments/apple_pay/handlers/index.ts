import {ApplePayment} from '@/hosted_fields/common/base-types';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {Callbacks} from '@/extensions/three_domain_secure/common/types';
import {sendToMasterIframe} from '@/hosted_fields/host/iframe-client-loader';
import {Gateway, PaymentMethodType, ValidateApplePaySessionPayload} from '@/internal/payment-intent/types';
import {Master as M} from '@/hosted_fields/common/enums';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {ApplePayMountOptions, ApplePayButtonColor, ApplePayButtonType, PaymentCredentialStatusResponse} from '../types';
import {flattenObj, jsonify} from '@/utils/utility-functions';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import Ids from '@/constants/ids';
import Helpers from '@/helpers';
import {detect} from '@/utils/browser';
import {BROWSERS, DEVICES, OS} from '@/utils/browser/constants';
import {DeviceType, BrowserName, OSName} from '@/utils/browser/types';
import {loadApplePaySdk} from '../utils';

declare global {
  interface Window {
    ApplePaySession: {
      supportsVersion: (version: number) => boolean;
      canMakePayments: () => boolean;
      canMakePaymentsWithActiveCard: (merchantId: string | number) => Promise<boolean>;
      applePayCapabilities: (merchantId?: string) => Promise<PaymentCredentialStatusResponse>;
      STATUS_SUCCESS: string | number;
      STATUS_FAILURE: string | number;
    };
  }
}

export default class ApplepayHandler extends PaymentIntentHandler implements ApplePayment {
  // Static cache for gateway handlers
  private static gatewayHandlerCache: Record<string, any> = {};

  constructor(...args) {
    super(...args);
  }

  supportsApplePay(): boolean {
    return window.ApplePaySession && window.ApplePaySession.supportsVersion(3);
  }

  isApplePayQRFlowSupported(): boolean {
    const gateway = this.getPaymentIntent().gateway;
    const browserInfo = detect();
    const platformType: DeviceType = browserInfo.deviceType;
    const browserName: BrowserName = browserInfo.browser.name;
    const osName: OSName = browserInfo.os.name;

    // Deutsche Bank uses widget-based approach (works everywhere, doesn't need native ApplePaySession)
    if (gateway === Gateway.DEUTSCHE_BANK) return true;

    // Avoid QR flow if Safari (supports native)
    if (browserName === BROWSERS.SAFARI) return false;

    // Adyen supports QR flow on desktop
    if (platformType === DEVICES.DESKTOP) {
      if (
        gateway === Gateway.CHECKOUT_COM ||
        gateway === Gateway.BRAINTREE ||
        gateway === Gateway.ADYEN ||
        gateway === Gateway.MOLLIE ||
        gateway === Gateway.VANTIV ||
        gateway === Gateway.MOYASAR
      ) {
        return true;
      }
      // Stripe supports QR flow on specific browsers
      const STRIPE_SUPPORTED_BROWSERS: ReadonlyArray<BrowserName> = [BROWSERS.CHROME, BROWSERS.EDGE, BROWSERS.OPERA];
      if (gateway === Gateway.STRIPE && STRIPE_SUPPORTED_BROWSERS.includes(browserName)) {
        return true;
      }
    }
    return false;
  }

  async mountPaymentButton(
    id: string,
    options: ApplePayMountOptions = {
      locale: 'en_US',
      buttonColor: ApplePayButtonColor.BLACK,
      buttonType: ApplePayButtonType.PLAIN,
    }
  ) {
    const supportsSession = this.supportsApplePay();
    const supportsQR = this.isApplePayQRFlowSupported();

    if (!supportsSession && !supportsQR) {
      return Promise.reject(new CbError(Errors.applePayNotSupported));
    }

    if (supportsSession && !this.canMakePayments()) {
      return Promise.reject(new CbError(Errors.applePayPaymentsNotAvailable));
    }

    const gatewayHandlerKey =
      this.getPaymentIntent().id + this.getPaymentIntent().gateway_account_id + this.getPaymentIntent().currency_code;
    if (ApplepayHandler.gatewayHandlerCache[gatewayHandlerKey]) {
      this.gatewayHandler = ApplepayHandler.gatewayHandlerCache[gatewayHandlerKey];
    } else {
      this.gatewayHandler = await this.getApplePayHandler(this.getPaymentIntent());
      ApplepayHandler.gatewayHandlerCache[gatewayHandlerKey] = this.gatewayHandler;
    }

    return this.gatewayHandler.mountPaymentButton(id, options);
  }

  canMakePayments(): boolean {
    return !!(window['ApplePaySession'] && window['ApplePaySession'].canMakePayments());
  }

  async applePayCapabilities(merchantIdentifier?: string): Promise<PaymentCredentialStatusResponse> | undefined {
    if (merchantIdentifier) {
      return window['ApplePaySession'].applePayCapabilities(merchantIdentifier);
    }
    if (this.getPaymentIntent().gateway == Gateway.ADYEN) {
      this.gatewayHandler = await this.getGatewayHandler(this.getPaymentIntent());
      return this.gatewayHandler.applePayCapabilities();
    } else {
      return Promise.reject(new CbError('Gateway not supported for apple pay capabilities'));
    }
  }

  handlePayment(callbacks?: Callbacks): Promise<any> {
    return new Promise((resolve) => {
      const success = (paymentIntent) => {
        const payload = {
          paymentIntent: {
            ...paymentIntent,
            payer_info: this.gatewayHandler.getPaymentData(),
          },
        };
        callbacks && callbacks.success && callbacks.success(payload);
        resolve(payload);
      };

      const error = (err) => {
        callbacks && callbacks.error && callbacks.error(err);
        throw err;
        // Promise will be fullfilled on calling reject function, so we will not call it
      };

      const click = (err) => {
        return callbacks && callbacks.click && callbacks.click();
        // Promise will be fullfilled on calling reject function, so we will not call it
      };

      const cancel = () => {
        return callbacks && callbacks.cancel && callbacks.cancel();
        // Promise will be fullfilled on calling reject function, so we will not call it
      };

      this.gatewayHandler.initCallbacks &&
        this.gatewayHandler.initCallbacks(
          {},
          {
            success,
            error,
            click,
            cancel,
          }
        );
    });
  }

  // To validate apple pay session
  protected validateApplePaySession(data: ValidateApplePaySessionPayload): Promise<any> {
    return sendToMasterIframe(M.Actions.ValidateApplePaySession, data);
  }

  protected async startCrossBrowserFlow(applePayData: any): Promise<void> {
    // Ensure Apple Pay SDK is loaded so browsers can show cross-browser modal/QR when applicable
    // Build PaymentRequest-compatible methodData + details
    const {methodData, details} = this.buildPaymentRequestForPaymentRequestAPI(applePayData);

    // Create PaymentRequest
    let request: PaymentRequest | null = null;
    try {
      // @ts-ignore - PaymentRequest typing differences across environments
      request = new window.PaymentRequest(methodData, details);
    } catch (err) {}

    // Use show() inside a user gesture (we're called from button click)
    let paymentResponse: any;
    try {
      paymentResponse = await request.show();
    } catch (err) {
      // user cancelled or browser refused to show
      throw err;
    }

    // At this point, the browser may have shown QR and the user completed on iPhone.
    // The shape of the response depends on platform / browser.
    // We attempt to extract Apple Pay payment data and call your confirmPayment() like onpaymentauthorized.
    try {
      // Common shapes:
      // paymentResponse.details.paymentData
      // paymentResponse.details.token.paymentData
      // paymentResponse.details.token (raw)
      const detailsObj = paymentResponse && paymentResponse.details ? paymentResponse.details : null;
      let applePaymentData: any = null;

      if (detailsObj) {
        // Try several likely locations
        applePaymentData =
          detailsObj.paymentData ||
          (detailsObj.token && detailsObj.token.paymentData) ||
          detailsObj.token ||
          detailsObj;
      }

      if (!applePaymentData) {
        // Some browsers put the whole payload in details; pass that through
        applePaymentData = detailsObj;
      }

      // Call your confirmPayment (same contract you use for onpaymentauthorized)
      await this.confirmPayment({
        paymentMethodType: PaymentMethodType.APPLEPAY,
        // The Checkout.com path used earlier expects: applePay: event.payment.token.paymentData
        // We'll pass applePaymentData under applePay key to reuse code paths
        applePay: applePaymentData,
      });

      // Tell the PaymentRequest UI we completed successfully
      if (paymentResponse && typeof paymentResponse.complete === 'function') {
        try {
          await paymentResponse.complete('success');
        } catch (e) {
          // ignore complete errors
        }
        this.callbackHandler.triggerSuccessCallback();
      }
    } catch (err) {
      // If anything goes wrong, complete with failure and rethrow
      if (paymentResponse && typeof paymentResponse.complete === 'function') {
        try {
          await paymentResponse.complete('fail');
        } catch (e) {
          // ignore
        }
        this.callbackHandler.triggerErrorCallback(err);
      }
      throw err;
    }
  }

  private buildPaymentRequestForPaymentRequestAPI(applePayData: any): {methodData: any[]; details: any; options?: any} {
    const methodData = [
      {
        data: {
          version: 3,
          ...applePayData,
        },
      },
    ];

    // Payment Request details (total + line items if any)
    const details: any = {
      total: {
        label: applePayData.total && applePayData.total.label ? applePayData.total.label : 'Total',
        amount: {
          currency: applePayData.currencyCode || this.getPaymentIntent().currency_code || 'USD',
          value: String(
            applePayData.total && applePayData.total.amount
              ? applePayData.total.amount
              : this.getPaymentIntent().amount / 100
          ),
        },
      },
    };

    return {methodData, details};
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

  private getApplePayHandler(paymentIntent: any): Promise<any> {
    switch (paymentIntent.gateway) {
      case Gateway.BRAINTREE:
        return this.getCommonHandler(paymentIntent);
      case Gateway.STRIPE:
        return this.getCommonHandler(paymentIntent);
      case Gateway.ADYEN:
        return this.getCommonHandler(paymentIntent);
      case Gateway.DEUTSCHE_BANK:
        return this.getCommonHandler(paymentIntent);
      case Gateway.MOYASAR:
        return this.getCommonHandler(paymentIntent);
      default:
        return this.getCommonHandler(paymentIntent, true);
    }
  }
}
