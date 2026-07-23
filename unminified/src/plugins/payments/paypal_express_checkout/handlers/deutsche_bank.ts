import {
  PaymentAttemptStatus,
  PaymentAttempt,
  Callbacks,
  PaymentIntent,
  PaymentMethodType,
} from '@/internal/payment-intent/types';
import {Options, PaymentInfo} from '../types';
import Helpers from '@/helpers';
import {loadScriptUsingPredicate} from '@/extensions/three_domain_secure/common/utils';
import PaypalHandler from '@/plugins/payments/paypal_express_checkout/handlers';

declare global {
  interface Window {
    widgetsolution: {
      init: (config: any) => Promise<any>;
    };
    deutscheBankCheckout: any;
  }
}

export default class DeutscheBankPayPalHandler extends PaypalHandler {
  private additionalData: PaymentInfo;

  constructor(handler: PaypalHandler, ...args) {
    super(...args);
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.PAYPAL_EXPRESS_CHECKOUT,
    });
  }

  handlePayment(callbacks: Callbacks): Promise<PaymentIntent> {
    this.initCallbacks({}, callbacks);
    return new Promise<PaymentIntent>((resolve, reject) => {
      this.callbackHandler.setPromiseResolvers(resolve, reject);
    });
  }

  mountPaymentButton(id: string, options: Options): Promise<any> {
    return Promise.all([this.getSessionId(), this.loadDBWidgetSdk()]).then(([sessionId]) => {
      if (sessionId) {
        this.kvl({
          action: 'paypal_sdk',
          result: 'true',
          payment_intent_id: this.getPaymentIntent().id,
        });
        return this.renderDeutscheBankWidget(id, options, sessionId);
      } else {
        return this.callbackHandler.triggerErrorCallback(new Error('Session ID not found'));
      }
    });
  }

  getSessionId() {
    return this.initPayment().then((data) =>
      this.confirmPayment(data).then((response: PaymentAttempt) => {
        return response.id_at_gateway;
      })
    );
  }

  private renderDeutscheBankWidget(id: string, options: Options, widgetSessionId: string): Promise<any> {
    const containerId = id.startsWith('#') ? id.slice(1) : id;

    return new Promise((resolve, reject) => {
      const widgetSolutionConfig = {
        container: containerId,
        sessionId: widgetSessionId,
        paymentMethod: 'paypal',
        events: {
          onInit: () => {
            resolve(true);
          },
          onCancel: () => {
            this.callbackHandler.triggerCancelCallback();
          },
          onError: (error: any) => {
            this.callbackHandler.triggerErrorCallback(error);
            reject(error);
          },
          onSuccess: (data: any) => {
            resolve(true);
          },
          onAuthorize: () => {
            this.confirmPayment();
          },
        },
        transactionData: {
          paypal: {
            buttonStyle: options.style,
          },
        },
      };

      try {
        this.widgetsolution()
          .init(widgetSolutionConfig)
          .catch((error) => {
            reject(error);
          });
      } catch (e) {
        reject(e);
      }
    });
  }

  protected handlePaymentAttemptStatus(paymentAttemptStatus: PaymentAttemptStatus) {
    switch (paymentAttemptStatus) {
      case PaymentAttemptStatus.AUTHORIZED:
        this.callbackHandler.triggerSuccessCallback();
        return Promise.resolve(this.getPaymentIntent());
      case PaymentAttemptStatus.REQUIRES_CHALLENGE:
        return Promise.resolve(this.getPaymentAttempt());
      case PaymentAttemptStatus.REFUSED:
        this.callbackHandler.triggerErrorCallback(this.callbackHandler.intentError());
        return Promise.reject(this.callbackHandler.intentError());
    }
    return this.handlePaymentAttempt(this.getPaymentAttempt());
  }

  private dbBaseUrl(): string {
    return Helpers.isTestSite() ? 'https://testmerch.directpos.de' : 'https://merch.directpos.de';
  }

  loadDBWidgetSdk(): Promise<any> {
    const sdkUrl = `${this.dbBaseUrl()}/rest-api/tool/widget_lib/widgetsolution.sdk.js`;

    if (!this.widgetsolution()) {
      return loadScriptUsingPredicate(sdkUrl, () => !!(this.widgetsolution() && this.widgetsolution().init));
    }

    if (this.widgetsolution() && !this.widgetsolution().init) {
      return loadScriptUsingPredicate(sdkUrl, () => !!(this.widgetsolution() && this.widgetsolution().init));
    }
    return Promise.resolve(true);
  }

  private widgetsolution() {
    return window['widgetsolution'];
  }
}
