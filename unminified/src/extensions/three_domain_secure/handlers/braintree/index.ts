import Abstract3DSHandler from '@/extensions/three_domain_secure/handlers/abstract';
import {
  PaymentAttempt,
  PaymentAttemptStatus,
  ConfirmApiPayload,
  PaymentIntent,
  ConfirmApiInputPayload,
  PaymentInfo,
} from '@/extensions/three_domain_secure/common/types';
import ThreeDSecureHandler from '@/extensions/three_domain_secure/index';
import {Braintree} from '@/extensions/three_domain_secure/handlers/braintree/types';
import Errors, {CbError, ErrorType} from '@/hosted_fields/common/errors';
import {
  validateRawCardDetails,
  loadScript,
  loadScriptUsingPredicate,
  removeEmptyKeys,
  onlyNumeric,
} from '../../common/utils';
import LightBox from '@/extensions/three_domain_secure/common/lightbox';
import {Master as M} from '@/hosted_fields/common/enums';
import Helpers from '@/helpers/index';
import {gwJsonify, getCurrencyDivisor, safeExecute} from '@/utils/utility-functions';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import Ids from '@/constants/ids';
import {Address} from '@/plugins/three_domain_secure/types';
import DeviceDataHelpers from '@/helpers/device-data';
import {constructPaymentIntentApiPayload} from '@/internal/common/utils';
import * as QS from 'qs';

export default class Braintree3DSHandler extends Abstract3DSHandler {
  private braintreeInstance: any;
  private braintree3DSInstance: any;
  private tokenResponse: Braintree.ClientTokenResponse;

  constructor(parent: ThreeDSecureHandler) {
    super(parent);
    if (parent.options && parent.options.braintree) {
      this.braintreeInstance = parent.options.braintree;
    }
  }

  validate(): boolean {
    const hasElements = !!this.paymentInfo.element;
    const hasTokenizer = !!this.paymentInfo.tokenizer;
    const hasRawCardDetails = !!this.paymentInfo.card;
    const hasReferenceId = !!this.getReferenceId();
    const hasCbToken = !!this.paymentInfo.cbToken;
    const hadPaymentComponent = !!this.paymentInfo.paymentComponent;

    if (!hasElements && !hasTokenizer && !hasRawCardDetails && !hasReferenceId && !hasCbToken && !hadPaymentComponent) {
      throw new CbError(Errors.missingBraintreePaymentInfo);
    }

    if (hasElements && !this.paymentInfo.element.tokenize) {
      throw new CbError(Errors.invalidBraintreeHostedFields);
    }

    if (hasReferenceId && (typeof this.getReferenceId() !== 'string' || !this.getReferenceId().length)) {
      throw new CbError(Errors.invalidCardReferenceId);
    }

    if (hasRawCardDetails) {
      validateRawCardDetails(this.paymentInfo.card);
    }

    return true;
  }

  private generateClientToken(): Promise<any> {
    const payload: ConfirmApiPayload = constructPaymentIntentApiPayload(this.getPaymentIntent());
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.GenerateBraintreeClientToken,
          data: payload,
        },
        Ids.MASTER_FRAME,
        {timeout: 10000}
      )
    );
  }

  private createBraintreeClientInstance(token: string): Promise<any> {
    if (!this.paymentInfo.card && !this.getReferenceId() && this.parent.options && this.parent.options.braintree) {
      return Promise.resolve(this.parent.options.braintree);
    }

    return this.braintree().client.create({
      authorization: token,
    });
  }

  private createBraintree3dsInstance() {
    return this.braintree().threeDSecure.create({
      version: 2,
      client: this.braintreeInstance,
    });
  }

  private handleElement(params: Braintree.ThreeDSParams) {
    return this.paymentInfo.element.tokenize().then((data: Braintree.TokenizedCard) => this.tokenizeFlow(data, params));
  }

  private getTokenizedCard(data: Braintree.TokenizerResponse) {
    if (!data || !data.creditCards || data.creditCards.constructor !== Array) {
      throw new CbError(Errors.invalidBraintreeTokenizedCard);
    }
    // TODO Add KVL
    if (!data.creditCards.length) throw new CbError(Errors.noBraintreeTokenizedCard);

    return data.creditCards.length && data.creditCards[0];
  }

  private handleTokenizer(params: Braintree.ThreeDSParams) {
    return this.paymentInfo
      .tokenizer()
      .then((data: Braintree.TokenizerResponse) => this.getTokenizedCard(data))
      .then((data: Braintree.TokenizedCard) => this.tokenizeFlow(data, params));
  }

  private support3DS1Fallback(params: Braintree.ThreeDSParams) {
    params.addFrame = (err, braintree3dsIframe) => {
      if (err) throw err;

      this.lightbox = new LightBox('braintree');
      this.lightbox.setIframe(braintree3dsIframe);
      this.openIframe();
    };

    params.removeFrame = (err, next) => {
      if (err) throw err;

      this.removeIframe();
      next();
    };
  }

  private tokenizeCard(cardDetails: Braintree.CardDetails) {
    const data = cardDetails;
    if (this.tokenResponse && this.tokenResponse.merchant_account_id) {
      if (this.tokenResponse.three_ds_enabled) data['authenticationInsight'] = true;
      data['merchantAccountId'] = this.tokenResponse.merchant_account_id;
    }
    return this.braintreeInstance.request({
      endpoint: 'payment_methods/credit_cards',
      method: 'post',
      data,
    });
  }

  private handleRawCardDetails(params: Braintree.ThreeDSParams) {
    let cardDetails: Braintree.CardDetails = this.getCardDetails();

    const billingAddress: Braintree.BillingAddress = this.getBillingAddress();
    if (billingAddress && Object.keys(billingAddress).length > 0) {
      const cardBillingAddress: Braintree.CardBillingAddress = removeEmptyKeys({
        countryCodeAlpha2: billingAddress.countryCodeAlpha2,
        extendedAddress: billingAddress.extendedAddress,
        firstName: billingAddress.givenName,
        lastName: billingAddress.surname,
        locality: billingAddress.locality,
        region: billingAddress.region,
        streetAddress: billingAddress.streetAddress,
        postalCode: billingAddress.postalCode,
        // company
        // countryCodeAlpha3
        // countryCodeNumeric
        // countryName:
      });
      cardDetails.creditCard.billingAddress = cardBillingAddress;
    }

    return this.tokenizeCard(cardDetails)
      .then((data: Braintree.TokenizerResponse) => this.getTokenizedCard(data))
      .then((data: Braintree.TokenizedCard) => this.tokenizeFlow(data, params));
  }

  private handleReferenceId(params: Braintree.ThreeDSParams) {
    if (!this.tokenResponse || !this.tokenResponse.payment_method_nonce) {
      throw new CbError(Errors.missingNonceForBraintreeReferenceId);
    }

    const data: Braintree.TokenizedCard = {
      nonce: this.tokenResponse.payment_method_nonce,
    };
    if (this.tokenResponse.auth_insight_regulation_env) {
      data.authenticationInsight = {
        regulationEnvironment: this.tokenResponse.auth_insight_regulation_env,
      };
    }
    if (this.tokenResponse.details) {
      data.details = this.tokenResponse.details;
    }
    return this.tokenizeFlow(data, params);
  }

  private tokenizeFlow(data: Braintree.TokenizedCard, params: Braintree.ThreeDSParams) {
    if (!this.tokenResponse.hasOwnProperty('three_ds_enabled') || this.tokenResponse.three_ds_enabled) {
      return this.createBraintree3dsInstance().then((braintree3dsInstance) => {
        this.braintree3DSInstance = braintree3dsInstance;
        return this.verifyCard(data, params);
      });
    }
    return this.confirmPayment({tmpToken: data.nonce});
  }

  private verifyCard(data: Braintree.TokenizedCard, params: Braintree.ThreeDSParams) {
    params.nonce = data.nonce;
    const regulationEnvironment = data.authenticationInsight && data.authenticationInsight.regulationEnvironment;
    if (data.details) params.bin = data.details.bin;
    params.onLookupComplete = function (data: Braintree.LookupParams, next: Function) {
      // TODO onLookupComplete callback
      next();
    };

    // Braintree 3DS 1.0 fallback
    this.support3DS1Fallback(params);
    if (
      this.tokenResponse.payment_method_challenge_requested ||
      regulationEnvironment === Braintree.REGULATION_ENVIRONMENT.PSD2
    ) {
      params.challengeRequested = true;
    } else {
      params.challengeRequested = false;
    }
    const ipAddress = this.tokenResponse.origin_ip_address;
    if (ipAddress) {
      params.additionalInformation = params.additionalInformation
        ? {...params.additionalInformation, ipAddress}
        : {ipAddress};
    }
    this.kvl({
      action: 'braintree_regulation_environment',
      regulation_environment: regulationEnvironment,
      ip_address: ipAddress,
    });

    //setting 3ds window size via acsWindowSize
    const challengeWindowSize = this.hasAdditionalData() && this.paymentInfo.additionalData.challengeWindowSize;

    if (challengeWindowSize) {
      params.additionalInformation = {
        ...params.additionalInformation,
        acsWindowSize: challengeWindowSize,
      };
    }

    // https://braintree.github.io/braintree-web/current/ThreeDSecure.html#verifyCard
    return this.braintree3DSInstance.verifyCard(params).then((resp: Braintree.VerifyResponse) => {
      // if (resp.liabilityShiftPossible && !resp.liabilityShifted) {
      //   return Promise.reject(
      //     new CbError(Errors.failedBraintreeThreeDSecureAuth)
      //   );
      // }

      return this.getDeviceData().then((deviceData) => {
        let payload: any = {tmpToken: resp.nonce};
        if (deviceData) {
          payload['additionalInfo'] = {braintree: {fraud: deviceData}};
        }
        return this.confirmPayment(payload);
      });
    });
  }

  // https://developers.braintreepayments.com/guides/premium-fraud-management-tools/client-side/javascript/v3
  private getDeviceData() {
    return DeviceDataHelpers.getBraintreeDeviceData(this.braintree(), this.braintreeInstance);
  }

  private async handleCbTokenFlow(params: Braintree.ThreeDSParams) {
    let data: Braintree.TokenizedCard = {
      nonce: this.paymentInfo.additionalData.vaultId,
    };
    const additionalInfo = this.paymentInfo.additionalData && this.paymentInfo.additionalData.additionalInformation;
    if (additionalInfo && additionalInfo.braintree && additionalInfo.braintree.creditCard) {
      data = Object.assign(data, additionalInfo.braintree.creditCard);
    }

    const paymentMethodNonce = await this.retrievePaymentMethodNonce(data.nonce);
    data.details = paymentMethodNonce.details;

    if (paymentMethodNonce.auth_insight_regulation_env) {
      data.authenticationInsight = {
        regulationEnvironment: paymentMethodNonce.auth_insight_regulation_env,
      };
    }

    return this.tokenizeFlow(data, params);
  }

  private createCbChallengeURL(params: Braintree.ThreeDSParams): string {
    const _params: any = {
      ...params,
      paymentIntentId: this.getPaymentIntent().id,
    };
    if (this.paymentInfo.additionalData && this.paymentInfo.additionalData.vaultId) {
      _params.vaultId = this.paymentInfo.additionalData.vaultId;
    }
    if (this.paymentInfo.cbToken) {
      _params.cbToken = this.paymentInfo.cbToken;
    } else if (this.getReferenceId()) {
      _params.referenceId = this.getReferenceId();
    }

    if (Helpers.getCbInstance().options.locale) {
      _params.locale = Helpers.getCbInstance().options.locale;
    }

    const queryString = QS.stringify(_params, {
      encode: true,
      addQueryPrefix: true,
    });

    const url = `${Helpers.getDomain()}/hosted_pages/threedsecure/braintree${queryString}`;
    return url;
  }

  private retrievePaymentMethodNonce(nonce: string): Promise<Braintree.RetrievePaymentMethodNonceResponse> {
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.RetrieveBraintreePaymentMethodNonce,
          data: {
            nonce,
            paymentIntentId: this.getPaymentIntent().id,
          },
        },
        Ids.MASTER_FRAME
      )
    ) as Promise<Braintree.RetrievePaymentMethodNonceResponse>;
  }

  private setupWorker() {
    const data: ConfirmApiPayload = {
      paymentIntentId: this.getPaymentIntent().id,
      businessEntityId: Helpers.getCbInstance().businessEntityId,
    };
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.SetupWorker,
          data,
        },
        Ids.MASTER_FRAME,
        {timeout: 10000}
      )
    );
  }

  private handleChallengeRedirectFlow(params: Braintree.ThreeDSParams): Promise<void> {
    const url = this.createCbChallengeURL(params);
    const intent = this.getPaymentIntent();
    if (this.callbacks.challenge && typeof this.callbacks.challenge === 'function') {
      this.callbacks.challenge(url);
    } else if (!!intent.success_url) {
      window.top.location.href = url;
      return Promise.resolve();
    }

    return this.setupWorker()
      .then(() => this.pollFor3DSCompletion())
      .then((data: any) => {
        this.setPaymentIntent(data.payment_intent);
        this.callSuccess();
      });
  }

  private isRedirectFlow(): boolean {
    return (
      !!(this.callbacks.challenge || this.getPaymentIntent().success_url) &&
      !!(this.paymentInfo.cbToken || this.getReferenceId()) &&
      !(this.hasAdditionalData() && this.paymentInfo.additionalData._skipRedirect)
    );
  }

  private paymentComponentFlow(params: Braintree.ThreeDSParams): Promise<any> {
    return this.tokenizePaymentComponentCard({
      paymentIntent: this.getPaymentIntent(),
      paymentComponent: this.paymentInfo.paymentComponent,
      additionalData: this.paymentInfo.additionalData,
    }).then((payload: PaymentInfo) => {
      this.paymentInfo = payload;
      return this.handleCbTokenFlow(params);
    });
  }

  private handlePaymentFlow(params: Braintree.ThreeDSParams) {
    if (this.paymentInfo.element) return this.handleElement(params);
    else if (this.paymentInfo.tokenizer) return this.handleTokenizer(params);
    else if (this.paymentInfo.card) return this.handleRawCardDetails(params);
    else if (this.isRedirectFlow()) return this.handleChallengeRedirectFlow(params);
    else if (this.getReferenceId()) return this.handleReferenceId(params);
    else if (this.paymentInfo.cbToken) return this.handleCbTokenFlow(params);
    else if (this.paymentInfo.paymentComponent) return this.paymentComponentFlow(params);
    else throw new CbError(Errors.missingBraintreePaymentInfo);
  }

  handlePayment(): void {
    this.checkNLoadScript()
      .then(() => this.generateClientToken())
      .then((resp: Braintree.ClientTokenResponse) => {
        this.tokenResponse = resp;
        return this.createBraintreeClientInstance(resp.client_token);
      })
      .then((braintreeClient) => {
        this.braintreeInstance = braintreeClient;
        const currencyDivisor = getCurrencyDivisor(this.getPaymentIntent().currency_code);
        const params: Braintree.ThreeDSParams = {
          amount: (this.getPaymentIntent().amount / currencyDivisor).toFixed(2),
          collectDeviceData: true,
        };

        if (this.hasAdditionalData()) {
          const billingAddress: Braintree.BillingAddress = this.getBillingAddress();
          if (billingAddress && Object.keys(billingAddress).length > 0) params.billingAddress = billingAddress;

          if (this.paymentInfo.additionalData.email) {
            params.email = this.paymentInfo.additionalData.email;
          }

          if (this.paymentInfo.additionalData.phone) {
            params.mobilePhoneNumber = onlyNumeric(this.paymentInfo.additionalData.phone);
          }
        }

        return this.handlePaymentFlow(params);
      })
      .catch(async (err) => {
        // If its a braintree client side error
        if (!!(err && err.name === 'BraintreeError')) {
          const intent: PaymentIntent = (await Braintree3DSHandler.retrievePaymentIntent(
            this.getPaymentIntent().id
          )) as PaymentIntent;
          const attempt = intent && intent.active_payment_attempt;

          // Check if payment intent is already refused
          if (!(attempt && attempt.status == PaymentAttemptStatus.REFUSED)) {
            // Cancel the active payment attempt if its not already refused.
            // If active payment attempt is absent, the attempt is created then marked as cancelled.
            // payment attempt is absent when there is a validation error before the 3DS payment process beings

            safeExecute(async () => {
              let errorReason: string = this.getErrorReason(err);
              await this.cancel(errorReason);
            });
          }
          err = this.sanitizeBraintreeError(err);
        }
        this.callError(err);
      });
  }

  getBillingAddress(): Braintree.BillingAddress {
    const billingAddress: Address = this.getCardBillingAddress();
    if (billingAddress) {
      let braintreeBillingAddress: Braintree.BillingAddress = {
        givenName: Helpers.normalizeString(billingAddress.firstName),
        surname: Helpers.normalizeString(billingAddress.lastName),
        phoneNumber: billingAddress.phone || this.paymentInfo.additionalData.phone,
        streetAddress: Helpers.normalizeString(billingAddress.addressLine1),
        extendedAddress: Helpers.normalizeString(billingAddress.addressLine2),
        line3: Helpers.normalizeString(billingAddress.addressLine3),
        locality: Helpers.normalizeString(billingAddress.city),
        region: billingAddress.stateCode,
        postalCode: billingAddress.zip ? billingAddress.zip.toString() : undefined,
        countryCodeAlpha2: billingAddress.countryCode,
      };
      braintreeBillingAddress = removeEmptyKeys(braintreeBillingAddress);
      return braintreeBillingAddress;
    }
  }

  getCardDetails(): Braintree.CardDetails {
    const card = this.paymentInfo.card;
    const cardholderName = `${card.firstName || ''} ${card.lastName || ''}`.trim();
    const creditCard: Braintree.CreditCard = {
      number: card.number,
      cvv: card.cvv,
      expirationDate: `${card.expiryMonth}/${card.expiryYear}`,
      options: {validate: true},
    };
    if (cardholderName) creditCard.cardholderName = Helpers.normalizeString(cardholderName);
    return {
      creditCard,
    };
  }

  getErrorReason(error: Braintree.ClientError): string | undefined {
    if (!error) return;
    // if error details are present
    if (error.details && error.details.originalError) {
      let orgErr = error.details.originalError;
      // check for field specific errors if only 1 present throw that error
      if (orgErr.fieldErrors && orgErr.fieldErrors.length == 1) {
        let fldErr = orgErr.fieldErrors[0];
        if (
          fldErr.fieldErrors &&
          fldErr.fieldErrors.length > 0 &&
          fldErr.fieldErrors[0] &&
          fldErr.fieldErrors[0].message
        ) {
          return fldErr.fieldErrors[0].message;
        }
      }
      // check for nested error details object if present throw that error
      else if (orgErr.details && orgErr.details.originalError) {
        orgErr = orgErr.details.originalError;
        if (orgErr) {
          return (orgErr.error && orgErr.error.message) || orgErr.message;
        }
      }
      // if nested error details object is not present, throw the error details message
      else {
        return (orgErr.error && orgErr.error.message) || orgErr.message;
      }
    }
    // throw the error event message if error details object is not present
    return error.message;
  }

  private sanitizeBraintreeError(error) {
    this.kvl({
      ...gwJsonify(error),
      action: 'gateway_client_error',
      gw: 'braintree',
    });
    return new CbError(
      {
        type: ErrorType.GatewayError,
        name: error.code,
        message: this.getErrorReason(error),
      },
      error
    );
  }

  handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    return Promise.resolve(true).then(() => {
      switch (paymentAttempt.status) {
        case PaymentAttemptStatus.AUTHORIZED:
          this.callSuccess();
          return true;
        case PaymentAttemptStatus.REFUSED:
        default:
          throw this.intentError();
      }
    });
  }

  private braintree() {
    return window['braintree'];
  }

  private checkNLoadScript(): Promise<any> {
    if (!this.braintree()) {
      return loadScript('https://js.braintreegateway.com/web/3.96.1/js/client.min.js', 'braintree').then(() =>
        Promise.all([
          loadScriptUsingPredicate(
            'https://js.braintreegateway.com/web/3.96.1/js/three-d-secure.min.js',
            () => !!this.braintree().threeDSecure
          ),
          loadScriptUsingPredicate(
            'https://js.braintreegateway.com/web/3.96.1/js/data-collector.min.js',
            () => !!this.braintree().dataCollector
          ),
        ])
      );
    } else {
      let promises = [];
      if (!this.braintree().threeDSecure) {
        promises.push(
          loadScriptUsingPredicate(
            `https://js.braintreegateway.com/web/${this.braintree().client.VERSION}/js/three-d-secure.min.js`,
            () => !!this.braintree().threeDSecure
          )
        );
      }
      if (!this.braintree().dataCollector) {
        promises.push(
          loadScriptUsingPredicate(
            `https://js.braintreegateway.com/web/${this.braintree().client.VERSION}/js/data-collector.min.js`,
            () => !!this.braintree().dataCollector
          )
        );
      }
      return Promise.all(promises);
    }
  }
}
