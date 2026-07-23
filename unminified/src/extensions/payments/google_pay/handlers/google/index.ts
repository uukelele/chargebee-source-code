import AbstractGooglePayHandler from '@/extensions/payments/google_pay/handlers/abstract';
import {
  PaymentAttemptStatus,
  PaymentAttempt,
  StripePaymentIntentParams,
  Gateway,
} from '@/extensions/three_domain_secure/common/types';
import {loadScriptUsingPredicate} from '@/extensions/three_domain_secure/common/utils';
import Helpers from '@/helpers';
import Errors, {CbError, ErrorType} from '@/hosted_fields/common/errors';
import {ButtonOption, PaymentData, PaymentRequestOptions} from '@/plugins/payments/google_pay/types';
import {safeGet, jsonify, isObjectEmpty, gwJsonify} from '@/utils/utility-functions';
import {createAdyenInstance, adyenHandlePaymentAttempt} from '@/utils/payments/adyen';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import {Master as M} from '@/hosted_fields/common/enums';
import Ids from '@/constants/ids';

const BASE_REQUEST = {
  apiVersion: 2,
  apiVersionMinor: 0,
};
const ALLOWED_CARD_NETWORKS = ['AMEX', 'DISCOVER', 'INTERAC', 'JCB', 'MASTERCARD', 'VISA'];
const ALLOWED_CARD_AUTH_METHODS = ['PAN_ONLY', 'CRYPTOGRAM_3DS'];

const encryptBlueSnapGpayPayment = (paymentInfo: string): string => {
  /* According to recommendation by Bluesnap
    https://developers.bluesnap.com/reference/google-pay#step-2-create-a-google-pay-wallet-token
  */
  return btoa(
    encodeURIComponent(paymentInfo).replace(/%([0-9A-F]{2})/g, function toSolidBytes(_match, p1) {
      return String.fromCharCode(`0x${p1}` as unknown as number);
    })
  );
};

export default class DirectGooglePayHandler extends AbstractGooglePayHandler {
  private button: HTMLElement;
  private paymentsClient: any;
  private gatewayCredential: any;
  // private braintreeClientToken: any;
  private stripeV3: any;
  private adyenClient: any;
  private clickBlocked: boolean = false;

  private getBaseCardPaymentMethod(paymentRequestOptions: PaymentRequestOptions): any {
    const cardParameters: any = {
      billingAddressRequired: false,
      allowedAuthMethods: ALLOWED_CARD_AUTH_METHODS,
      allowedCardNetworks: ALLOWED_CARD_NETWORKS,
    };

    if (paymentRequestOptions.requestBillingAddress) {
      cardParameters.billingAddressRequired = true;
      cardParameters.billingAddressParameters = {
        format: 'FULL',
      };
    }

    return {
      type: 'CARD',
      parameters: cardParameters,
    };
  }

  private getGoogleIsReadyToPayRequest(paymentRequestOptions: PaymentRequestOptions): any {
    return Object.assign({}, BASE_REQUEST, {
      allowedPaymentMethods: [this.getBaseCardPaymentMethod(paymentRequestOptions)],
    });
  }

  private getCardPaymentMethod(paymentRequestOptions: PaymentRequestOptions): any {
    return Object.assign({}, this.getBaseCardPaymentMethod(paymentRequestOptions), {
      tokenizationSpecification: this.getTokenizationSpecification(),
    });
  }

  private getTokenizationSpecification(): any {
    // Vantiv uses DIRECT tokenization: Google Pay returns an encrypted payload
    // (encryptedMessage/ephemeralPublicKey/tag) that our backend decrypts using
    // the merchant-provided private key. The public key here is the one the
    // merchant shared with us and registered with Google Pay.
    if (this.getPaymentIntent().gateway === Gateway.VANTIV) {
      return {
        type: 'DIRECT',
        parameters: {
          protocolVersion: 'ECv2',
          publicKey: this.gatewayCredential.google_pay && this.gatewayCredential.google_pay.public_key,
        },
      };
    }
    return {
      type: 'PAYMENT_GATEWAY',
      parameters: this.getTokenizationSpecParameters(),
    };
  }

  private getTokenizationSpecParameters(): any {
    switch (this.getPaymentIntent().gateway) {
      // case Gateway.BRAINTREE:
      // 	return {
      // 		"gateway": "braintree",
      // 		"braintree:apiVersion": "v1",
      // 		"braintree:sdkVersion": "3.63.0",
      // 		"braintree:merchantId": this.gatewayCredential.google_pay && this.gatewayCredential.google_pay.braintree_merchant_id,
      // 		"braintree:merchantAccountId": "candybar",
      // 		"braintree:clientKey": this.braintreeClientToken
      // 	}
      case Gateway.STRIPE:
        return {
          gateway: 'stripe',
          'stripe:version': '2018-10-31',
          'stripe:publishableKey': this.gatewayCredential.publishable_key,
        };
      case Gateway.ADYEN:
        return {
          gateway: 'adyen',
          gatewayMerchantId: this.gatewayCredential.google_pay && this.gatewayCredential.google_pay.adyen_merchant_id,
        };
      case Gateway.BLUESNAP:
        return {
          gateway: 'bluesnap',
          gatewayMerchantId:
            this.gatewayCredential.google_pay && this.gatewayCredential.google_pay.bluesnap_merchant_id,
        };
      case Gateway.NMI:
        return {
          gateway: 'gatewayservices',
          gatewayMerchantId: this.gatewayCredential.google_pay && this.gatewayCredential.google_pay.gateway_merchant_id,
        };
      case Gateway.CHECKOUT_COM:
        return {
          gateway: 'checkoutltd',
          gatewayMerchantId: this.gatewayCredential.google_pay.public_key,
        };
    }
  }

  private getGoogleMerchantId(): string {
    if (this.getPaymentIntent().gateway == Gateway.ADYEN && this.gatewayCredential.payment_methods_response) {
      let pmResponse = this.gatewayCredential.payment_methods_response;
      let gpay = pmResponse.find((e) => e.type == 'googlepay') || pmResponse.find((e) => e.type == 'paywithgoogle');
      return gpay && gpay.configuration && gpay.configuration.merchantId;
    }
    return this.gatewayCredential.google_pay && this.gatewayCredential.google_pay.google_merchant_id;
  }

  private getGooglePaymentDataRequest(paymentRequestOptions: PaymentRequestOptions): any {
    const paymentDataRequest: any = Object.assign({}, BASE_REQUEST);
    const {merchant_country_code: countryCode, business_name: merchantName} = this.gatewayCredential.google_pay || {};
    paymentDataRequest.environment = this.getEnvironment();
    paymentDataRequest.allowedPaymentMethods = [this.getCardPaymentMethod(paymentRequestOptions)];
    paymentDataRequest.transactionInfo = this.getGoogleTransactionInfo();
    paymentDataRequest.shippingAddressRequired = paymentRequestOptions.requestShippingAddress || false;
    paymentDataRequest.emailRequired = paymentRequestOptions.requestPayerEmail || false;

    if (this.getGoogleMerchantId() != null) {
      paymentDataRequest.merchantInfo = {
        merchantId: this.getGoogleMerchantId(),
        ...(merchantName
          ? {
              // https://developers.google.com/pay/api/web/reference/request-objects#MerchantInfo
              // merchantName should be encoded to UTF-8
              merchantName: encodeURIComponent(merchantName),
            }
          : {}),
      };
    }
    if (countryCode) {
      // Sending country code if present.
      // Required for merchants that process transactions in the European Economic Area (EEA)
      // https://developers.google.com/pay/api/web/guides/tutorial#paymentdatarequest
      paymentDataRequest.transactionInfo.countryCode = countryCode;
    }
    return paymentDataRequest;
  }

  private createGooglePaymentClient(): any {
    // @ts-ignore
    return new window.google.payments.api.PaymentsClient({
      environment: this.getEnvironment(),
    });
  }

  mountPaymentButton(
    id: string,
    buttonStyle: ButtonOption,
    paymentRequestOptions: PaymentRequestOptions
  ): Promise<any> {
    if (!this.getPaymentIntent()) {
      throw new CbError(Errors.missingPaymentIntentForMountButton);
    }

    buttonStyle = Object.assign({buttonColor: 'default', buttonType: 'short'}, buttonStyle);

    return Promise.all([this.preloadConfig(), this.loadGpayJS()])
      .then(() => {
        this.paymentsClient = this.createGooglePaymentClient();
        return this.paymentsClient.isReadyToPay(this.getGoogleIsReadyToPayRequest(paymentRequestOptions));
      })
      .then((response) => {
        if (response.result) {
          var container = document.querySelector(id);
          // Removing any Gpay button mounted already
          this.button && container.removeChild(this.button);
          this.button = this.paymentsClient.createButton({
            buttonColor: buttonStyle.buttonColor,
            buttonType: buttonStyle.buttonType,
            buttonSizeMode: buttonStyle.buttonSizeMode,
            buttonLocale: buttonStyle.buttonLocale,
            onClick: async () => {
              try {
                await this.callClick();
              } catch (err) {
                this.callError(err);
                return;
              }
              if (this.clickBlocked === false) {
                this.clickBlocked = true;
                this.paymentsClient
                  .loadPaymentData(this.getGooglePaymentDataRequest(paymentRequestOptions))
                  .then((paymentData) => {
                    let billingAddress =
                      paymentData &&
                      paymentData.paymentMethodData &&
                      paymentData.paymentMethodData.info &&
                      paymentData.paymentMethodData.info.billingAddress
                        ? paymentData.paymentMethodData.info.billingAddress
                        : {};
                    let cardDetails =
                      paymentData &&
                      paymentData.paymentMethodData &&
                      paymentData.paymentMethodData.info &&
                      paymentData.paymentMethodData.info.cardDetails
                        ? paymentData.paymentMethodData.info.cardDetails
                        : {};
                    this.approvedPayload = {
                      ...paymentData,
                      billingAddress,
                      cardDetails,
                    };

                    this.setPaymentData(this.transformPaymentData(paymentData));
                    let fPaymentData = this.fetchTokenFromPaymentData(paymentData);
                    if (fPaymentData.token) {
                      return this.confirmPayment(this.constructConfirmPIPayload(fPaymentData.token));
                    } else {
                      throw new CbError(Errors.missingTokenInfoInPaymentData);
                    }
                  })
                  .catch((err) => {
                    // Google Pay rejects with `{statusCode: 'CANCELED'}` when the user
                    // dismisses the payment sheet. Other rejection sources in this chain
                    // (e.g. `throw this.intentError()`) may yield a falsy value, so guard
                    // against `err` being `null`/`undefined` before reading `statusCode`.
                    if (err && err.statusCode === 'CANCELED') {
                      this.callCancel();
                    } else {
                      this.callError(err);
                    }
                  })
                  .finally(() => {
                    this.clickBlocked = false;
                  });
              } else {
                return;
              }
            },
          });
          container.appendChild(this.button);
          return Promise.resolve(true);
        }
      });
  }

  private transformPaymentData(paymentData: any): PaymentData {
    return {
      cardInfo: {
        last4: safeGet(paymentData, 'paymentMethodData.info.cardDetails'),
        brand: safeGet(paymentData, 'paymentMethodData.info.cardNetwork'),
      },
    };
  }

  private preloadConfig() {
    let promises = [this.fetchGatewayCredential()];

    // if(this.getPaymentIntent().gateway == Gateway.BRAINTREE) {
    // 	promises.push(this.generateBraintreeClientToken());
    // }

    return Promise.all(promises).then((args) => {
      this.gatewayCredential = args[0];
      // if(this.getPaymentIntent().gateway == Gateway.BRAINTREE) {
      // 	this.braintreeClientToken = args[1].client_token;
      // }
      return Promise.resolve(true);
    });
  }

  private stripeHandleCardAction(payload) {
    return this.checkNLoadScript(payload).then(() => {
      const isRedirectFlow = !!(
        payload.redirect_url &&
        !this.getPaymentIntent().success_url &&
        this.callbacks.challenge
      );

      if (isRedirectFlow) {
        return this.handleRedirectMode(payload);
      }
      if (payload && payload.obj_type === 'setup_intent') {
        return this.stripeV3.handleCardSetup(payload.client_secret);
      } else {
        return this.stripeV3.handleCardAction(payload.client_secret);
      }
    });
  }

  private handleRedirectMode(payload: StripePaymentIntentParams): Promise<any> {
    // Sending a message to parent window, to handle the redirect
    this.sendRedirectUrl(payload.redirect_url);

    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.PollPaymentIntent3DSResult,
          data: {
            paymentIntentId: this.getPaymentIntent().id,
          },
        },
        Ids.MASTER_FRAME,
        {timeout: 10 * 60 * 1000}
      )
    );
  }

  private sendRedirectUrl(redirectURL: string) {
    // https://js.stripe.com, https://hooks.stripe.com,
    if (this.callbacks.challenge) {
      this.callbacks.challenge(redirectURL);
    }
  }

  protected handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (this.getPaymentIntent().gateway) {
      case Gateway.ADYEN:
        return this.adyenHandlePaymentAttempt(paymentAttempt);
      case Gateway.CHECKOUT_COM:
        return this.checkoutComHandlePaymentAttempt(paymentAttempt);
      case Gateway.VANTIV:
        return this.vantivHandlePaymentAttempt(paymentAttempt);
      default:
        return this.stripeHandlePaymentAttempt(paymentAttempt);
    }
  }

  protected vantivHandlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    // Vantiv Google Pay goes straight through: backend decrypts the token and
    // authorizes with Vantiv. No client-side 3DS/challenge is expected.
    return Promise.resolve(true).then(() => {
      switch (paymentAttempt.status) {
        case PaymentAttemptStatus.AUTHORIZED: {
          this.callSuccess();
          return true;
        }
        case PaymentAttemptStatus.REFUSED:
        default: {
          throw this.intentError();
        }
      }
    });
  }

  protected adyenHandlePaymentAttempt(paymentAttempt: PaymentAttempt) {
    return Promise.resolve(true).then(() => {
      switch (paymentAttempt.status) {
        case PaymentAttemptStatus.AUTHORIZED: {
          this.callSuccess();
          return true;
        }
        case PaymentAttemptStatus.REQUIRES_CHALLENGE:
        case PaymentAttemptStatus.REQUIRES_REDIRECTION:
        case PaymentAttemptStatus.REQUIRES_IDENTIFICATION:
          return createAdyenInstance(this.getPaymentIntent(), this).then((adyenClient) => {
            this.adyenClient = adyenClient;
            return adyenHandlePaymentAttempt(paymentAttempt, this, this.adyenClient);
          });
        case PaymentAttemptStatus.REFUSED:
        default: {
          throw this.intentError();
        }
      }
    });
  }

  protected checkoutComHandlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    return Promise.resolve(true).then(() => {
      switch (paymentAttempt.status) {
        case PaymentAttemptStatus.AUTHORIZED: {
          this.callSuccess();
          return true;
        }
        case PaymentAttemptStatus.REQUIRES_CHALLENGE: {
          // Checkout.com 3DS challenge flow
          let payload = paymentAttempt.action_payload;
          if (payload && payload.redirect_url) {
            // Handle 3DS redirect for Checkout.com
            return this.handleRedirectMode(payload).then((result) => {
              if (result && result.payment_intent) {
                this.setPaymentIntent(result.payment_intent);
                return this.handlePaymentAttempt(result.payment_intent.active_payment_attempt);
              }
              return this.confirmPayment();
            });
          }
          throw this.intentError();
        }
        case PaymentAttemptStatus.REQUIRES_REDIRECTION: {
          // Handle redirect scenarios for Checkout.com
          let payload = paymentAttempt.action_payload;
          if (payload && payload.redirect_url) {
            return this.handleRedirectMode(payload).then((result) => {
              if (result && result.payment_intent) {
                this.setPaymentIntent(result.payment_intent);
                return this.handlePaymentAttempt(result.payment_intent.active_payment_attempt);
              }
              return this.confirmPayment();
            });
          }
          throw this.intentError();
        }
        case PaymentAttemptStatus.REFUSED:
        default: {
          throw this.intentError();
        }
      }
    });
  }

  protected stripeHandlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    return Promise.resolve(true).then(() => {
      switch (paymentAttempt.status) {
        case PaymentAttemptStatus.REQUIRES_CHALLENGE: {
          let payload = paymentAttempt.action_payload;
          return this.stripeHandleCardAction(payload).then((result) => {
            if (result.error) {
              throw this.sanitizeStripeError(result.error);
            }
            const isRedirectFlow = !!(
              payload.redirect_url &&
              !this.getPaymentIntent().success_url &&
              this.callbacks.challenge
            );
            if (isRedirectFlow) {
              this.setPaymentIntent(result.payment_intent);
              return this.handlePaymentAttempt(result.payment_intent.active_payment_attempt);
            }
            return this.confirmPayment();
          });
        }
        case PaymentAttemptStatus.AUTHORIZED: {
          this.callSuccess();
          return true;
        }
        case PaymentAttemptStatus.REFUSED:
        default: {
          throw this.intentError();
        }
      }
    });
  }

  private fetchTokenFromPaymentData(paymentData): any {
    switch (this.getPaymentIntent().gateway) {
      case Gateway.STRIPE:
        let rawToken = paymentData.paymentMethodData.tokenizationData.token;
        let jsonToken = JSON.parse(rawToken);
        return {
          token: jsonToken['id'],
        };
      case Gateway.ADYEN:
      case Gateway.VANTIV:
        // Vantiv DIRECT tokenization: forward encrypted payload as-is for backend decryption.
        return {
          token: paymentData.paymentMethodData.tokenizationData.token,
        };
      case Gateway.CHECKOUT_COM:
        let utf8EncodedPaymentData = paymentData.paymentMethodData.tokenizationData.token;
        return {
          token: JSON.parse(utf8EncodedPaymentData),
        };
      case Gateway.BLUESNAP:
        return {
          token: encryptBlueSnapGpayPayment(JSON.stringify(paymentData)),
        };
      case Gateway.NMI:
        return {
          token: paymentData.paymentMethodData.tokenizationData.token,
        };
    }
  }

  private formatAddress(address) {
    return {
      addressLine1: address.address1,
      addressLine2: address.address2,
      addressLine3: address.address3,
      zip: address.postalCode,
      stateCode: address.administrativeArea,
      city: address.locality,
      countryCode: address.countryCode,
    };
  }

  private constructConfirmPIPayload(token) {
    let otherDetails = {} as Record<string, string | Record<string, string>>;
    let shippingAddressObj = {} as Record<string, string>;
    const _email = this.approvedPayload.email;

    if (this.approvedPayload.shippingAddress) {
      shippingAddressObj = this.formatAddress(this.approvedPayload.shippingAddress);
    }

    if (!isObjectEmpty(this.approvedPayload.billingAddress)) {
      const _billingAddress = this.approvedPayload.billingAddress;
      let names = _billingAddress.name && _billingAddress.name.split(' ');
      if (names && names.length > 1) {
        otherDetails.firstName = names[0];
        otherDetails.lastName = names[1];
      } else {
        otherDetails.name = _billingAddress.name;
      }

      otherDetails = {
        ...otherDetails,
        billingAddress: this.formatAddress(_billingAddress),
      };
    }
    if (
      this.getPaymentIntent().gateway === Gateway.BLUESNAP ||
      this.getPaymentIntent().gateway === Gateway.ADYEN ||
      this.getPaymentIntent().gateway === Gateway.CHECKOUT_COM ||
      this.getPaymentIntent().gateway === Gateway.VANTIV ||
      this.getPaymentIntent().gateway === Gateway.NMI
    ) {
      const tokenKey = this.getPaymentIntent().gateway === Gateway.CHECKOUT_COM ? 'googlePay' : 'tempToken';
      const returnObj: {paymentMethodType: string; paymentMethodDetails: any; shippingAddress?: any} = {
        paymentMethodType: 'google_pay',
        paymentMethodDetails: {
          ...otherDetails,
          [tokenKey]: token,
        },
      };
      if (Object.keys(shippingAddressObj).length > 0) {
        returnObj.shippingAddress = shippingAddressObj;
      }
      if (_email) {
        returnObj.paymentMethodDetails.email = _email;
      }
      return returnObj;
    } else {
      return {tmpToken: token, paymentMethodType: 'google_pay'};
    }
  }

  private google() {
    return window['google'];
  }

  loadGpayJS(): Promise<any> {
    if (!(this.google() && this.google().payments)) {
      return loadScriptUsingPredicate(
        'https://pay.google.com/gp/p/js/pay.js',
        () => !!(this.google() && this.google().payments)
      );
    }
    return Promise.resolve(true);
  }

  private getStripe(): any {
    return window['Stripe'];
  }

  private isStripeV3Available() {
    let stripe = this.getStripe();
    return stripe && (stripe.version == 3 || stripe.StripeV3);
  }

  private checkNLoadScript(payload) {
    let promises: Promise<any>[] = [];

    if (!this.isStripeV3Available()) {
      promises.push(
        loadScriptUsingPredicate('https://js.stripe.com/v3/', () => {
          return !!this.isStripeV3Available();
        })
      );
    }

    return new Promise((resolve, reject) => {
      Promise.all(promises)
        .then((args) => {
          // this.getStripe().setPublishableKey(payload.publishable_key);
          this.stripeV3 = this.getStripe()(payload.publishable_key);
          resolve(true);
        })
        .catch((error) => {
          reject(new CbError(error));
        });
    });
  }

  private sanitizeStripeError(error) {
    if (!error) return new CbError();
    delete error.payment_method;
    this.kvl({
      ...gwJsonify(error),
      action: 'gateway_client_error',
      gw: 'stripe',
    });
    /**
     * {
     *  code: "payment_intent_authentication_failure"
     *  doc_url: "https://stripe.com/docs/error-codes/payment-intent-authentication-failure"
     *  message: "We are unable to authenticate your payment method. Please choose a different payment method and try again."
     *  payment_method: {id: "pm_1F5CDkBMHbSvNZGeLeojRHXn", object: "payment_method", billing_details: {…}, card: {…}, created: 1565273041, …}
     *  type: "invalid_request_error"
     * }
     */
    return new CbError(
      {
        name: error.code,
        type: ErrorType.GatewayError,
        message: error.message,
      },
      error
    );
  }
}
