import AbstractThreeDSecureHandler from '@/extensions/three_domain_secure/handlers/abstract';
import ThreeDSecureHandler from '@/extensions/three_domain_secure/index';
import {PaymentAttempt, PaymentAttemptStatus, CardInfo} from '@/extensions/three_domain_secure/common/types';
import Errors, {CbError, ErrorType} from '@/hosted_fields/common/errors';
import {validateRawCardDetails, loadScriptUsingPredicate} from '@/extensions/three_domain_secure/common/utils';
import {gwJsonify, getCurrencyDivisor} from '@/utils/utility-functions';
import Helpers from '@/helpers';

interface GatewayPublicCrediatials {
  integrationKey: string;
  country: string;
}
const ebanxDocCountryCodes = ['ar', 'br', 'uy'];

export default class Ebanx3DSHandler extends AbstractThreeDSecureHandler {
  private gwPubCred: GatewayPublicCrediatials;

  constructor(parent: ThreeDSecureHandler) {
    super(parent);
  }

  validate(): boolean {
    const hasRawCard = !!this.paymentInfo.card;
    const hasReferenceId = !!this.getReferenceId();
    const hasCardComponent = !!this.paymentInfo.cardComponent;
    const hadPaymentComponent = !!this.paymentInfo.paymentComponent;

    if (!hasRawCard && !hasReferenceId && !hasCardComponent && !hadPaymentComponent) {
      throw new CbError(Errors.missingEbanxPaymentInfo);
    }

    if (hasRawCard) {
      validateRawCardDetails(this.paymentInfo.card);
    }

    return true;
  }

  validateDocumentId(): Promise<void> {
    return new Promise((resolve, reject) => {
      const docInformation = {
        type: {},
        document: {},
      };
      const document = this.paymentInfo.additionalData && this.paymentInfo.additionalData.document;
      if (!(this.getCountryCode() && ebanxDocCountryCodes.includes(this.getCountryCode()))) {
        resolve();
      }

      if (!document.type || !document.number) {
        reject(new CbError(Errors.invalidFields));
      }
      docInformation.type = this.getCountryCode().concat('_').concat(document.type);
      docInformation.document = document.number;

      this.getEbanx()
        .utils.document.check(docInformation)
        .then((verificationData) => {
          if (
            verificationData.status &&
            verificationData.status == 'success' &&
            verificationData.data &&
            verificationData.data.document &&
            verificationData.data.document.isValid
          ) {
            resolve();
          } else {
            reject(new CbError(Errors.invalidEbanxDocument));
          }
        });
    });
  }

  handlePayment(): void {
    this.checkNLoadScript()
      .then(() => {
        return this.callPaymentFlow();
      })
      .then((payload: any) => this.confirmPayment(payload))
      .then(() => {
        this.callSuccess();
      })
      .catch((error) => {
        this.callError(error instanceof CbError ? error : new CbError(error));
      });
  }

  callPaymentFlow() {
    if (this.paymentInfo.card) {
      return this.cardFlow();
    } else if (this.getReferenceId()) {
      return this.referenceIdFlow();
    } else if (this.paymentInfo.cardComponent) {
      return this.getConfirmPayload({cardComponent: this.paymentInfo.cardComponent});
    } else if (this.paymentInfo.paymentComponent) {
      return this.getConfirmPayload({paymentComponent: this.paymentInfo.paymentComponent});
    }
  }

  cardFlow(): Promise<any> {
    return this.validateDocumentId()
      .then(() => this.authenticateFlow())
      .then((threeDsInfo) => {
        return this.getConfirmPayload({
          card: {
            number: this.paymentInfo.card.number,
            expiryMonth: this.paymentInfo.card.expiryMonth,
            expiryYear: this.paymentInfo.card.expiryYear,
            cvv: this.paymentInfo.card.cvv,
          },
          threeDsInfo,
        });
      });
  }

  authenticateFlow(): Promise<any> {
    if (!this.isAuthenticationRequired()) {
      return Promise.resolve(null);
    }
    return this.getEbanx()
      .threeDSecure.authenticate(this.transformToEbanxCard(this.paymentInfo.card))
      .then((authenticationData) => {
        return Promise.resolve({
          eci: authenticationData.threeds_eci,
          cryptogram: authenticationData.threeds_cryptogram,
          xid: authenticationData.threeds_xid,
          version: authenticationData.threeds_version,
          trxid: authenticationData.threeds_trxid,
        });
      });
  }

  isAuthenticationRequired(): boolean {
    return this.paymentInfo.additionalData.is3dsRequired && 'mx' === this.getCountryCode();
  }

  referenceIdFlow(): Promise<any> {
    return this.getConfirmPayload({});
  }

  getConfirmPayload(paymentData: any): Promise<any> {
    let payload = {
      paymentMethodType: 'card',
      paymentMethodDetails: {},
      shippingAddress: {},
      additionalInfo: {},
    };
    payload.paymentMethodDetails = {
      ...paymentData,
      ...this.getCustomerInfo(),
      firstName: this.getCardBillingAddress() && this.getCardBillingAddress().firstName,
      lastName: this.getCardBillingAddress() && this.getCardBillingAddress().lastName,
      billingAddress: this.getCardBillingAddress(),
    };
    payload.shippingAddress = this.getShippingAddress();

    return this.attachDeviceData().then((deviceId: string) => {
      const documentNumber =
        this.paymentInfo &&
        this.paymentInfo.additionalData &&
        this.paymentInfo.additionalData.document &&
        this.paymentInfo.additionalData.document.number;

      if (documentNumber) {
        payload.additionalInfo['payer'] = JSON.stringify({
          document: documentNumber,
        });
      }
      if (deviceId) {
        payload.additionalInfo['fraud'] = JSON.stringify({
          device_session_id: deviceId,
        });
      }
      return Promise.resolve(payload);
    });
  }

  protected handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    return Promise.resolve(true).then(() => {
      if (paymentAttempt.status == PaymentAttemptStatus.AUTHORIZED) {
        return true;
      } else {
        throw this.intentError();
      }
    });
  }

  private getEbanx(): any {
    return window['EBANX'];
  }

  private sanitizeEbanxError(error) {
    if (!error) return new CbError();
    delete error.payment_method;
    this.kvl({
      ...gwJsonify(error),
      action: 'gateway_client_error',
      gw: 'ebanx',
    });
    return new CbError(
      {
        name: error.code,
        type: ErrorType.GatewayError,
        message: error.message,
      },
      error
    );
  }

  private transformToEbanxCard(card: CardInfo) {
    const paymentInformation = {
      card: {
        number: card.number, //card.number,
        expirationMonth: card.expiryMonth,
        expirationYear: card.expiryYear.toString().slice(-2),
        holderName: `${card.firstName} ${card.lastName}`.trim(),
      },
      paymentMethod: 'creditcard', // we support only creditcard
    };
    const currencyDivisor = getCurrencyDivisor(this.getPaymentIntent().currency_code);
    const orderInformation = {
      amountDetails: {
        totalAmount: (this.getPaymentIntent().amount / currencyDivisor).toFixed(2),
        currency: this.getPaymentIntent().currency_code,
      },
      billTo: {},
    };

    const cardBillingAddress = this.paymentInfo.additionalData && this.paymentInfo.additionalData.cardBillingAddress;
    const document = this.paymentInfo.additionalData && this.paymentInfo.additionalData.document;

    if (cardBillingAddress) {
      let map = {
        addressLine1: 'address1',
        city: 'locality',
        countryCode: 'country',
        stateCode: 'administrativeArea',
        zip: 'postalCode',
        email: 'email',
        phone: 'mobilePhone',
      };
      Object.keys(map).forEach((key) => {
        if (cardBillingAddress[key]) {
          orderInformation['billTo'][map[key]] = cardBillingAddress[key];
        }
      });
    }

    const personalIdentification = {
      id: {},
      type: {},
    };

    if (document) {
      personalIdentification.id = document.number;
      personalIdentification.type = document.type.toUpperCase();
    }

    return {
      orderInformation,
      paymentInformation,
      personalIdentification,
    };
  }

  private fetchPublishableKey() {
    if (this.gwPubCred) {
      return Promise.resolve(this.gwPubCred);
    }
    return this.fetchGatewayCredential().then((data) => {
      let country = data.country ? data.country.toLowerCase() : this.getCountryCode();
      this.gwPubCred = {
        integrationKey: data.public_integration_key,
        country: country,
      };
      return Promise.resolve(this.gwPubCred);
    });
  }

  attachDeviceData(): Promise<string> {
    return this.getEbanx()
      .deviceFingerprint.getSession()
      .then((session) => {
        return Promise.resolve(session.device_id);
      })
      .catch((error) => {
        return Promise.reject(error);
      });
  }

  checkNLoadScript() {
    let promises: Promise<any>[] = [
      this.fetchPublishableKey(),
      loadScriptUsingPredicate('https://ebanx-js.ebanx.com/v1.79.0/dist/ebanx.js', () => !!this.getEbanx()),
    ];
    return new Promise((resolve, reject) => {
      Promise.all(promises)
        .then((args) => {
          this.getEbanx().init({
            publicIntegrationKey: args[0].integrationKey,
            country: args[0].country,
            mode: Helpers.isTestSite() ? 'test' : 'production',
          });
          resolve(true);
        })
        .catch((error) => {
          reject(new CbError(error));
        });
    });
  }

  getCountryCode(): string {
    return (
      this.getCardBillingAddress() &&
      this.getCardBillingAddress().countryCode &&
      this.getCardBillingAddress().countryCode.toLowerCase()
    );
  }
}
