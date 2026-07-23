import AbstractGooglePayHandler from '@/extensions/payments/google_pay/handlers/abstract';
import {PaymentAttemptStatus, PaymentAttempt, PaymentMethodType} from '@/internal/payment-intent/types';
import {ButtonOption, PaymentRequestOptions} from '@/plugins/payments/google_pay/types';
import Helpers from '@/helpers';
import {loadScriptUsingPredicate} from '@/extensions/three_domain_secure/common/utils';

declare global {
  interface Window {
    widgetsolution: {
      init: (config: any) => Promise<any>;
    };
    deutscheBankCheckout: any;
  }
}

export default class DeutscheBankGooglePayHandler extends AbstractGooglePayHandler {
  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.GOOGLE_PAY,
    });
  }

  mountPaymentButton(
    id: string,
    buttonStyle: ButtonOption = {},
    paymentRequestOptions: PaymentRequestOptions = {}
  ): Promise<any> {
    return Promise.all([this.getSessionId(), this.loadDBWidgetSdk()]).then(([sessionId]) => {
      if (sessionId) {
        this.kvl({
          action: 'google_pay_sdk',
          result: 'true',
          payment_intent_id: this.getPaymentIntent().id,
        });
        return this.renderDeutscheBankWidget(id, buttonStyle, paymentRequestOptions, sessionId);
      } else {
        this.callError(new Error('Session ID not found'));
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

  private renderDeutscheBankWidget(
    id: string,
    buttonStyle: ButtonOption,
    paymentRequestOptions: PaymentRequestOptions,
    widgetSessionId: string
  ): Promise<any> {
    buttonStyle = Object.assign({buttonColor: 'default', buttonType: 'short', buttonSizeMode: 'static'}, buttonStyle);

    const containerId = id.startsWith('#') ? id.slice(1) : id;

    return new Promise((resolve, reject) => {
      const widgetSolutionConfig = {
        container: containerId,
        sessionId: widgetSessionId,
        paymentMethod: 'googlepay',
        events: {
          onInit: () => {
            resolve(true);
          },
          onCancel: () => {
            this.callCancel();
          },
          onError: (error: any) => {
            this.callError(error);
            reject(error);
          },
          onSuccess: (data: any) => {
            this.callSuccess();
          },
          onAuthorize: () => {
            this.reattempt = false;
            return this.confirmPayment();
          },
        },
        transactionData: this.buildTransactionData(buttonStyle, paymentRequestOptions),
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

  private buildTransactionData(buttonStyle: ButtonOption, paymentRequestOptions: PaymentRequestOptions): any {
    const googlePayConfig: any = {
      buttonStyle: {
        buttonColor: buttonStyle.buttonColor,
        buttonType: buttonStyle.buttonType,
        // TODO: Revert once V4 will send properly
        buttonSizeMode: 'static',
      },
    };

    if (paymentRequestOptions.requestPayerEmail) {
      googlePayConfig.emailRequired = paymentRequestOptions.requestPayerEmail;
    }
    if (paymentRequestOptions.requestShippingAddress) {
      googlePayConfig.shippingAddressRequired = paymentRequestOptions.requestShippingAddress;
    }

    return {
      googlepay: googlePayConfig,
    };
  }

  protected handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    return Promise.resolve(true).then(() => {
      switch (paymentAttempt.status) {
        case PaymentAttemptStatus.REQUIRES_CHALLENGE: {
          return this.getPaymentAttempt();
        }
        case PaymentAttemptStatus.AUTHORIZED: {
          return true;
        }
        case PaymentAttemptStatus.REFUSED:
        default: {
          throw this.intentError();
        }
      }
    });
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
