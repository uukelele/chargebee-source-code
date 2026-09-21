import ApplepayHandler from '@/plugins/payments/apple_pay/handlers';
import {loadScriptUsingPredicate} from '@/extensions/three_domain_secure/common/utils';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {Callbacks, PaymentMethodType, PaymentAttemptStatus, PaymentAttempt} from '@/internal/payment-intent/types';
import {ApplePayMountOptions, ApplePayButtonColor, ApplePayButtonType} from '@/plugins/payments/apple_pay/types';
import Helpers from '@/helpers';

declare global {
  interface Window {
    widgetsolution: {
      init: (config: any) => Promise<any>;
    };
  }
}

export default class DeutscheBankApplePayHandler extends ApplepayHandler {
  private mountOptions: ApplePayMountOptions;

  constructor(handler: ApplepayHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
  }

  async mountPaymentButton(
    selector: string,
    options: ApplePayMountOptions = {
      locale: 'en_US',
      buttonColor: ApplePayButtonColor.BLACK,
      buttonType: ApplePayButtonType.PLAIN,
    }
  ): Promise<any> {
    this.mountOptions = options;

    if (!this.getPaymentIntent()) {
      throw new CbError(Errors.missingPaymentIntentForMountButton);
    }

    return Promise.all([this.getSessionId(), this.loadDBWidgetSdk()]).then(([sessionId]) => {
      if (sessionId) {
        this.kvl({
          action: 'apple_pay_sdk',
          result: 'true',
          payment_intent_id: this.getPaymentIntent().id,
          gateway: 'deutsche_bank',
        });
        return this.renderDeutscheBankWidget(selector, options, sessionId);
      } else {
        const error = new Error('Session Id not found');
        this.callbackHandler.triggerErrorCallback(new CbError(error));
        throw error;
      }
    });
  }

  private getSessionId(): Promise<string> {
    return this.initPayment().then((data) =>
      this.confirmPayment(data).then((response: PaymentAttempt) => {
        return response.id_at_gateway;
      })
    );
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.APPLEPAY,
    });
  }

  private renderDeutscheBankWidget(
    selector: string,
    options: ApplePayMountOptions,
    widgetSessionId: string
  ): Promise<boolean> {
    const containerId = selector.startsWith('#') ? selector.slice(1) : selector;

    return new Promise((resolve, reject) => {
      const widgetSolutionConfig = {
        container: containerId,
        sessionId: widgetSessionId,
        paymentMethod: 'applepay',
        events: {
          onInit: () => {
            resolve(true);
          },
          onCancel: () => {
            this.callbackHandler.triggerCancelCallback();
          },
          onError: (error: any) => {
            this.callbackHandler.triggerErrorCallback(new CbError(error));
            reject(error);
          },
          onSuccess: (result: any) => {
            resolve(true);
          },
          onClick: () => this.callbackHandler.triggerClickCallback(),
          onAuthorize: () => {
            return this.confirmPayment();
          },
        },
        transactionData: this.buildTransactionData(options),
      };

      try {
        this.widgetsolution()
          .init(widgetSolutionConfig)
          .catch((error) => {
            this.kvl({
              action: 'apple_pay_widget_init_error',
              gateway: 'deutsche_bank',
              error: error,
            });
            reject(error);
          });
      } catch (e) {
        this.kvl({
          action: 'apple_pay_widget_init_exception',
          gateway: 'deutsche_bank',
          error: e,
        });
        reject(e);
      }
    });
  }

  private buildTransactionData(options: ApplePayMountOptions): any {
    const requiredBillingContactFields: string[] = [];
    const requiredShippingContactFields: string[] = [];

    if (options.requestBilling) {
      requiredBillingContactFields.push('postalAddress');
    }

    if (options.requestShipping) {
      requiredShippingContactFields.push('postalAddress');
    }

    if (options.requestPayerEmail) {
      requiredShippingContactFields.push('email');
    }

    if (options.requestPayerName) {
      requiredShippingContactFields.push('name');
    }

    if (options.requestPayerPhone) {
      requiredShippingContactFields.push('phone');
    }

    const applePayConfig: any = {
      buttonStyle: {
        type: options.buttonType || ApplePayButtonType.PLAIN,
        style: options.buttonColor || ApplePayButtonColor.BLACK,
      },
      requiredBillingContactFields,
      requiredShippingContactFields,
    };

    if (options.recurringPaymentRequest) {
      applePayConfig.recurring = {
        paymentDescription: options.recurringPaymentRequest.paymentDescription,
        billingAgreement: options.recurringPaymentRequest.billingAgreement,
        managementURL: options.recurringPaymentRequest.managementURL,
        tokenNotificationURL: options.recurringPaymentRequest.tokenNotificationURL,
      };
    } else {
      applePayConfig.recurring = {
        paymentDescription: 'Vaulting',
        managementURL: this.getManagementURL(),
      };
    }

    return {
      applepay: applePayConfig,
    };
  }

  private getManagementURL(): string {
    return Helpers.getReferrer().concat('/portal/v2/login');
  }

  protected handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    return this.handlePaymentAttemptStatus(paymentAttempt.status);
  }

  protected handlePaymentAttemptStatus(paymentAttemptStatus: PaymentAttemptStatus): Promise<any> {
    switch (paymentAttemptStatus) {
      case PaymentAttemptStatus.AUTHORIZED:
        this.callbackTriggered = true;
        this.callbackHandler.triggerSuccessCallback();
        return Promise.resolve(this.getPaymentIntent());
      case PaymentAttemptStatus.REQUIRES_CHALLENGE:
        return Promise.resolve(this.getPaymentAttempt());
      case PaymentAttemptStatus.REFUSED:
        this.callbackTriggered = true;
        this.callbackHandler.triggerErrorCallback(this.callbackHandler.intentError());
        return Promise.reject(this.callbackHandler.intentError());
      default:
        return this.handlePaymentAttempt(this.getPaymentAttempt());
    }
  }

  private dbBaseUrl(): string {
    return Helpers.isTestSite() ? 'https://testmerch.directpos.de' : 'https://merch.directpos.de';
  }

  private loadDBWidgetSdk(): Promise<any> {
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

  initCallbacks(paymentInfo, callbacks: Callbacks) {
    super.initCallbacks(paymentInfo, callbacks);
  }
}
