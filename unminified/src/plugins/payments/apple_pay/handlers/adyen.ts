import {ComponentMountStatus} from '@/hosted_fields/common/enums';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {PaymentIntentStatus, PaymentMethodType} from '@/internal/payment-intent/types';
import {
  ApplePaymentEvent,
  AdyenApplePayConfiguration,
  ApplePayMountOptions,
  PaymentCredentialStatusResponse,
  PaymentCredentialStatus,
  AdyenApplePayConfigurationV6,
} from '@/plugins/payments/apple_pay/types';
import Helpers from '@/helpers';
import {Master as M} from '@/hosted_fields/common/enums';
import ApplepayHandler from '@/plugins/payments/apple_pay/handlers';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import Ids from '@/constants/ids';
import {constructPaymentIntentApiPayload} from '@/internal/common/utils';
import {transformAddress} from '../utils';
import Logger from '@/utils/logger_old';

import {loadAdyenJsAndCssForV6, NEW_ADYEN_VERSION} from '@/utils/payments/adyen';

export default class AdyenApplepayHandler extends ApplepayHandler {
  status: ComponentMountStatus = ComponentMountStatus.Created;
  private adyenClient: any;
  private adyenCheckout: any;
  private gwData: any;
  private applePayToken: string;
  paymentEvent: ApplePaymentEvent;

  constructor(handler: ApplepayHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
  }

  getPaymentData(): any {
    const paymentEvent = this.paymentEvent.payment;
    const payload: any = {
      shipping_address: transformAddress(paymentEvent.shippingContact),
      billing_address: transformAddress(this.paymentEvent.payment.billingContact),
    };
    if (paymentEvent && paymentEvent.shippingContact) {
      payload.customer = {
        firstName: paymentEvent.shippingContact.givenName,
        lastName: paymentEvent.shippingContact.familyName,
        email: paymentEvent.shippingContact.emailAddress,
      };
    }
    if (
      paymentEvent &&
      paymentEvent.token &&
      paymentEvent.token.paymentMethod &&
      paymentEvent.token.paymentMethod.displayName
    ) {
      payload.card = {
        last4: paymentEvent.token.paymentMethod.displayName,
      };
    }
    return payload;
  }

  applePayCapabilities = async (): Promise<PaymentCredentialStatusResponse> => {
    await this.createAdyenCheckout();
    const {ApplePay} = window['AdyenWeb'];
    const applepayComponent = new ApplePay(this.adyenCheckout, {});
    return applepayComponent.applePayCapabilities();
  };

  async mountPaymentButton(id, options: ApplePayMountOptions) {
    await this.createAdyenClientV6(options);
    this.kvl({action: 'adyen_client_created', gateway: 'adyen'});
    return this.mountButton(id);
  }

  private fetchGatewayCredentials(): Promise<any> {
    if (this.gwData) {
      return Promise.resolve(this.gwData);
    }
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.FetchGatewayCredential,
          data: constructPaymentIntentApiPayload(this.getPaymentIntent()),
        },
        Ids.MASTER_FRAME,
        {timeout: 10000}
      )
    ).then((data: any) => {
      return data;
    });
  }

  private getGWDataAndLoadAdyenJs = async (): Promise<any> => {
    return this.fetchGatewayCredentials().then((gwData) => {
      return loadAdyenJsAndCssForV6(NEW_ADYEN_VERSION, gwData.sdk_live_url_suffix).then(() => {
        this.gwData = gwData;
      });
    });
  };

  private createAdyenCheckout = async (): Promise<any> => {
    await this.getGWDataAndLoadAdyenJs();
    const environment = Helpers.isTestSite() ? 'test' : 'live';
    const {AdyenCheckout} = window['AdyenWeb'];

    // @ts-ignore
    this.adyenCheckout = await AdyenCheckout({
      environment,
      clientKey: this.gwData.client_key,
      showPayButton: true,
      // ...(options.locale ? {locale: options.locale} : {}),
      paymentMethodsResponse: {
        paymentMethods: this.gwData.payment_methods_response,
      },
      countryCode: this.gwData.apple_pay.merchant_country_code,
    });

    this.kvl({action: 'adyen_checkout_created', gateway: 'adyen'});
    return this.adyenCheckout;
  };

  private createAdyenClientV6 = async (options?: ApplePayMountOptions): Promise<any> => {
    if (!this.adyenCheckout) {
      this.adyenCheckout = await this.createAdyenCheckout();
    }
    const {ApplePay} = window['AdyenWeb'];
    const config: Partial<AdyenApplePayConfigurationV6> = this.buildApplePayConfig(this.gwData, options);
    Object.assign(config, {
      onSubmit: async (state, component, actions) => {
        try {
          this.applePayToken = state.data.paymentMethod.applePayToken;
          let _email = null;

          // Only extract email if shippingContact exists
          if (this.paymentEvent && this.paymentEvent.payment && this.paymentEvent.payment.shippingContact) {
            _email = this.paymentEvent.payment.shippingContact.emailAddress || null;
          }

          const intent = await this.confirmPayment({
            tmpToken: this.applePayToken,
            paymentMethodType: PaymentMethodType.APPLEPAY,
            customer: {email: _email},
          });
          if (intent.status === PaymentIntentStatus.AUTHORIZED) {
            actions.resolve({});
            component.setStatus('success');
          } else {
            actions.reject();
            component.setStatus('error');
          }
        } catch (err) {
          actions.reject(err);
        }
      },
      onAuthorized: (data, actions) => {
        try {
          if (data && data.authorizedEvent) {
            this.paymentEvent = data.authorizedEvent;
            actions.resolve({});
          } else {
            throw new Error('Invalid authorized event');
          }
        } catch (err) {
          actions.reject(err);
        }
      },
    });

    this.adyenClient = new ApplePay(this.adyenCheckout, config);
    return this.adyenClient;
  };

  private buildApplePayConfig(gwData: any, options: ApplePayMountOptions): any {
    const paymentIntent = this.getPaymentIntent();
    const applePayMethod = gwData.payment_methods_response.find((method) => method.type === 'applepay');
    const refererDomain = this.extractRefererDomain();

    const config: any = {
      amount: {
        currency: paymentIntent.currency_code,
        value: paymentIntent.amount,
      },
      buttonType: (options && options.buttonType) || 'plain',
      buttonColor: (options && options.buttonColor) || 'black',
    };

    if (options && options.requestBilling) {
      config.requiredBillingContactFields = ['postalAddress'];
    }

    if (
      options &&
      (options.requestShipping || options.requestPayerEmail || options.requestPayerName || options.requestPayerPhone)
    ) {
      config.requiredShippingContactFields = [];

      if (options.requestShipping) {
        config.requiredShippingContactFields.push('postalAddress');
      }

      if (options.requestPayerEmail) {
        config.requiredShippingContactFields.push('email');
      }

      if (options.requestPayerName) {
        config.requiredShippingContactFields.push('name');
      }

      if (options.requestPayerPhone) {
        config.requiredShippingContactFields.push('phone');
      }
    }

    if (options && options.recurringPaymentRequest) {
      config.recurringPaymentRequest = options.recurringPaymentRequest;
    }

    config.onClick = async (resolve, reject) => {
      try {
        await this.callbackHandler.triggerClickCallback();
        resolve();
      } catch (err) {
        reject(err);
      }
    };

    //This callback is to be called when user closes the Apple Pay payment window QR or modal
    config.onApplePayCodeClose = () => {
      this.callbackHandler.triggerCancelCallback();
    };

    const cbInstance = Helpers.getCbInstance();
    const referrerModule = cbInstance && cbInstance.options && cbInstance.options.referrerModule;

    if (
      refererDomain &&
      applePayMethod &&
      applePayMethod.configuration &&
      (referrerModule === Ids.CB_PAYMENT_COMPONENTS || referrerModule === Ids.PC_FPC_V4 || referrerModule === Ids.PC_INAPP_V4)
    ) {
      config.onValidateMerchant = this.buildMerchantValidator(gwData, refererDomain, applePayMethod);
    }

    return config;
  }

  private buildMerchantValidator = (gwData: any, domain: string, method: any) => {
    return (resolve, reject) => {
      const checkoutURL = Helpers.isTestSite()
        ? `https://checkoutshopper-test.adyen.com/checkoutshopper/`
        : `https://checkoutshopper-live.adyen.com/checkoutshopper/`;
      const validationURL = `${checkoutURL}v1/applePay/sessions?clientKey=${gwData.client_key}`;

      const payload = {
        payload: {
          validationURL,
          domain,
          displayName: method.configuration.merchantName,
          merchantId: method.configuration.merchantId,
        },
        paymentIntentId: this.getPaymentIntent().id,
      };

      this.validateApplePaySession(payload)
        .then((response) => {
          if (response.data != null) {
            const decodedData = Buffer.from(response.data, 'base64').toString('utf-8');
            if (!decodedData) reject('Could not decode Apple Pay session');
            const session = JSON.parse(decodedData);
            resolve(session);
          } else if (response.error != null) {
            reject(response.error);
          } else {
            reject();
          }
        })
        .catch((error) => {
          console.log(error);
          reject();
        });
    };
  };

  private extractRefererDomain = (): string | null => {
    try {
      const params = new URLSearchParams(window.location.search);
      const referer = params.get('referer');
      const cbInstance = Helpers.getCbInstance();
      const module = cbInstance && cbInstance.options && cbInstance.options.referrerModule;

      if (referer && (module === Ids.CB_PAYMENT_COMPONENTS || module === Ids.PC_FPC_V4 || module === Ids.PC_INAPP_V4)) {
        const domain = new URL(referer).hostname;
        this.kvl({action: 'apple_pay_referer', referer_domain: domain, gateway: 'adyen'});
        return domain;
      }
    } catch (e) {
      Logger.error(e);
    }
    return null;
  };

  private async mountButton(id): Promise<boolean> {
    try {
      const isAvailable = await this.adyenClient.isAvailable();
      if (isAvailable === false) {
        throw new CbError(Errors.applePayNotSupported);
      }
      await this.adyenClient.mount(id);
      this.kvl({action: 'apple_pay_mount_button', gateway: 'adyen', message: 'Button mounted'});
      return true;
    } catch (error) {
      this.kvl({action: 'apple_pay_mount_button', gateway: 'adyen', error: error.message || 'Button not mounted'});
      console.error('Error mounting Adyen Apple Pay button:', error);
      return false;
    }
  }
}
