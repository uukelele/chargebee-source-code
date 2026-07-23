import AbstractGooglePayHandler from '@/extensions/payments/google_pay/handlers/abstract';
import {PaymentAttemptStatus, PaymentAttempt} from '@/extensions/three_domain_secure/common/types';
import {loadScript, loadScriptUsingPredicate} from '@/extensions/three_domain_secure/common/utils';
import Helpers from '@/helpers';
import {Braintree} from '@/extensions/three_domain_secure/handlers/braintree/types';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {ButtonOption, PaymentData, PaymentRequestOptions} from '@/plugins/payments/google_pay/types';
import {safeGet, getCurrencyDivisor} from '@/utils/utility-functions';
import BraintreeUtils from '@/utils/payments/braintree';

export default class BraintreeGooglePayHandler extends AbstractGooglePayHandler {
  private button: HTMLElement;
  private braintreeInstance: any;
  private braintreeGpayInstance: any;
  private googlePaymentClient: any;
  private tokenResponse: Braintree.ClientTokenResponse;
  private clickBlocked: boolean = false;

  private createBraintreeClientInstance(token: string): Promise<any> {
    if (this.parent.options && this.parent.options.braintree) {
      return Promise.resolve(this.parent.options.braintree);
    }

    return this.braintree().client.create({
      authorization: token,
    });
  }

  private createBraintreeGpayInstance(): Promise<any> {
    if (Helpers.isTestSite()) {
      return this.braintree().googlePayment.create({
        googlePayVersion: 2,
        client: this.braintreeInstance,
      });
    } else {
      return this.fetchGatewayCredential().then((gatewayCredential) => {
        return this.braintree().googlePayment.create({
          googlePayVersion: 2,
          client: this.braintreeInstance,
          googleMerchantId: gatewayCredential.google_pay.google_merchant_id,
        });
      });
    }
  }

  private createGooglePaymentClient(): any {
    // @ts-ignore
    return new window.google.payments.api.PaymentsClient({
      environment: this.getEnvironment(),
    });
  }

  private getPaymentDataRequest(paymentRequestOptions: PaymentRequestOptions) {
    return this.braintreeGpayInstance.createPaymentDataRequest({
      shippingAddressRequired: paymentRequestOptions.requestShippingAddress || false,
      emailRequired: paymentRequestOptions.requestPayerEmail || false,
      allowedPaymentMethods: [
        {
          type: 'CARD',
          parameters: {
            billingAddressRequired: paymentRequestOptions.requestBillingAddress || false,
          },
        },
      ],
      transactionInfo: this.getGoogleTransactionInfo(),
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

    return Promise.all([this.loadGpayJS(), this.loadBraintreeJS()])
      .then(() => this.generateBraintreeClientToken())
      .then((resp: Braintree.ClientTokenResponse) => {
        this.tokenResponse = resp;
        return this.createBraintreeClientInstance(resp.client_token);
      })
      .then((braintreeInstance) => {
        this.braintreeInstance = braintreeInstance;
        return this.createBraintreeGpayInstance();
      })
      .then((braintreeGpayInstance) => {
        this.braintreeGpayInstance = braintreeGpayInstance;
        this.googlePaymentClient = this.createGooglePaymentClient();

        return this.googlePaymentClient.isReadyToPay({
          apiVersion: 2,
          apiVersionMinor: 0,
          allowedPaymentMethods: this.braintreeGpayInstance.createPaymentDataRequest().allowedPaymentMethods,
        });
      })
      .then((response) => {
        if (response.result) {
          var container = document.querySelector(id);
          // Removing any Gpay button mounted already
          this.button && container.removeChild(this.button);
          this.button = this.googlePaymentClient.createButton({
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
                this.googlePaymentClient
                  .loadPaymentData(this.getPaymentDataRequest(paymentRequestOptions))
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
                    return this.braintreeGpayInstance.parseResponse(paymentData);
                  })
                  .then((result) => {
                    return this.checkFor3DSVerification(result, this.getPaymentIntent());
                  })
                  .then((nonce) => {
                    return this.confirmPayment({
                      paymentMethodType: 'google_pay',
                      tmpToken: nonce,
                    });
                  })
                  .catch((err) => {
                    // Check if the error is due to user cancellation
                    if (err.statusCode === 'CANCELED') {
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

  checkFor3DSVerification(result, intent) {
    this.kvl({
      action: 'braintree_google_pay_3ds',
      threeds_status: result.isNetworkTokenized === false,
      is_network_tokenized: result.isNetworkTokenized,
      challenge_requested: this.tokenResponse.payment_method_challenge_requested,
    });
    if (result.isNetworkTokenized === false) {
      // eligible for 3DS Verification
      const currencyDivisor = getCurrencyDivisor(intent.currency_code);

      const params = {
        amount: (intent.amount / currencyDivisor).toFixed(2),
        nonce: result.nonce,
        email: this.approvedPayload ? this.approvedPayload.email : '',
        billingAddress: this.approvedPayload ? this.approvedPayload.billingAddress : '',
        collectDeviceData: true,
      };
      return BraintreeUtils.createBraintree3dsInstance(this.braintreeInstance)
        .then((braintree3DSInstance) => {
          return BraintreeUtils.doCardVerification(
            result,
            params,
            this.tokenResponse.payment_method_challenge_requested,
            braintree3DSInstance
          );
        })
        .then((resp: Braintree.VerifyResponse) => {
          return resp.nonce;
        });
    } else {
      return Promise.resolve(result.nonce);
    }
  }

  private transformPaymentData(paymentData: any): PaymentData {
    return {
      cardInfo: {
        last4: safeGet(paymentData, 'cardInfo.cardDetails'),
        brand: safeGet(paymentData, 'cardInfo.cardNetwork'),
      },
    };
  }

  protected handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
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

  private braintree() {
    return window['braintree'];
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

  private loadBraintreeJS(): Promise<any> {
    if (!this.braintree()) {
      return loadScript('https://js.braintreegateway.com/web/3.96.1/js/client.min.js', 'braintree').then(() => {
        return loadScriptUsingPredicate(
          'https://js.braintreegateway.com/web/3.96.1/js/google-payment.min.js',
          () => !!this.braintree().googlePayment
        );
      });
    }
    if (this.braintree() && !this.braintree().googlePayment) {
      return loadScriptUsingPredicate(
        `https://js.braintreegateway.com/web/${this.braintree().client.VERSION}/js/google-payment.min.js`,
        () => !!this.braintree().googlePayment
      );
    }
    return Promise.resolve(true);
  }
}
