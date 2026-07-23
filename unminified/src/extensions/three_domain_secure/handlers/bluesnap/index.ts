import AbstractThreeDSecureHandler from '@/extensions/three_domain_secure/handlers/abstract';
import {PaymentAttempt, PaymentAttemptStatus, PaymentInfo} from '@/extensions/three_domain_secure/common/types';
import {AdditionalData} from '@/plugins/three_domain_secure/types';
import {Bluesnap} from '@/extensions/three_domain_secure/handlers/bluesnap/types';
import {validateRawCardDetails, loadScript} from '@/extensions/three_domain_secure/common/utils';
import {Master as M} from '@/hosted_fields/common/enums';
import Errors, {CbError, ErrorType} from '@/hosted_fields/common/errors';
import {gwJsonify, getCurrencyDivisor} from '@/utils/utility-functions';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import Ids from '@/constants/ids';
import Helpers from '@/helpers/index';
import DeviceDataHelpers from '@/helpers/device-data';
import {constructPaymentIntentApiPayload} from '@/internal/common/utils';

export default class Bluesnap3DSHandler extends AbstractThreeDSecureHandler {
  private sessionId: string;
  private pfToken: any;
  private existingCreditCard: any;

  validate(): boolean {
    const hasRawCard = !!this.paymentInfo.card;
    const hasReferenceId = !!this.getReferenceId();
    const hasCbToken = !!this.paymentInfo.cbToken;
    const hadPaymentComponent = !!this.paymentInfo.paymentComponent;
    if (!hasRawCard && !hasReferenceId && !hasCbToken && !hadPaymentComponent) {
      throw new CbError(Errors.missingBluesnapPaymentInfo);
    }

    if (hasRawCard) {
      validateRawCardDetails(this.paymentInfo.card);
    }
    return true;
  }

  async handlePayment(): Promise<void> {
    if (this.paymentInfo && this.paymentInfo.paymentComponent) {
      this.paymentInfo = await this.tokenizePaymentComponentCard({
        paymentIntent: this.getPaymentIntent(),
        paymentComponent: this.paymentInfo.paymentComponent,
        additionalData: this.paymentInfo.additionalData,
      });
    }
    Promise.all([this.createPfToken(), this.loadBluesnap()])
      .then(([{pfToken, creditCard}]) => {
        this.pfToken = pfToken;
        this.existingCreditCard = creditCard;
        if (this.getReferenceId() || this.paymentInfo.card || this.paymentInfo.cbToken) {
          return new Promise((resolve) => {
            this.loadDeviceDataCheck()
              .then((sessionId) => {
                this.sessionId = sessionId;
              })
              .catch((err) => {
                this.logtoKVL(err);
                this.logError(err, {
                  action: 'gateway_client_error',
                  gw: 'bluesnap',
                });
              })
              .finally(() => {
                resolve(this.getConfirmPayload());
              });
          });
        }
      })
      .then((payload) => this.confirmPayment(payload))
      .catch((err) => {
        err = this.sanitizeBluesnapError(err);
        this.callError(err);
      });
  }

  protected handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
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

  private getBluesnap() {
    return window['bluesnap'];
  }

  private getConfirmPayload(): Promise<any> {
    return new Promise(async (resolve, reject) => {
      let payload: any = {};

      if (this.paymentInfo.card) {
        payload.paymentMethod = this.paymentInfo.card;
      } else if (this.paymentInfo.cbToken) {
        payload.cbToken = this.paymentInfo.cbToken;
      }

      if (this.hasAdditionalData()) {
        const additionalData: AdditionalData = this.paymentInfo.additionalData;
        if (additionalData.email) {
          payload.email = additionalData.email;
        }
        if (additionalData.phone) {
          payload.customer = {
            phone: additionalData.phone,
          };
        }
        payload.cardBillingAddress = this.getCardBillingAddress();
      }

      this.getBluesnap().threeDsPaymentsSetup(this.pfToken, (resp) => {
        if (resp.code == 1) {
          if (resp.threeDSecure) {
            payload.additionalInfo = {
              threeDsecureReferenceId: resp.threeDSecure.threeDSecureReferenceId,
            };
            if (this.sessionId) {
              payload.additionalInfo.fraudSessionId = this.sessionId;
            }
          }
          resolve(payload);
        } else {
          let message = '';
          if (resp.info.errors && resp.info.errors[0]) {
            message = resp.info.errors[0];
          } else if (resp.info.warnings && resp.info.warnings[0]) {
            message = resp.info.warnings[0];
          }
          let error = {
            code: resp.code,
            message: message,
          };
          reject(this.sanitizeBluesnapError(error));
        }
      });
      this.getBluesnap().threeDsPaymentsSubmitData(this.getBluesnapCardInfo());
    });
  }

  private getBluesnapCardInfo(): Bluesnap.SubmitCardInfo {
    const currencyDivisor = getCurrencyDivisor(this.getPaymentIntent().currency_code);
    let card: Bluesnap.SubmitCardInfo = {
      amount: parseFloat((this.getPaymentIntent().amount / currencyDivisor).toFixed(2)),
      currency: this.getPaymentIntent().currency_code,
    };
    if (this.paymentInfo.card) {
      card.ccNumber = this.paymentInfo.card.number;
      card.cvv = this.paymentInfo.card.cvv;
      card.expDate = `${this.paymentInfo.card.expiryMonth}/${this.paymentInfo.card.expiryYear}`;
    }
    if (this.existingCreditCard) {
      card.last4Digits = this.existingCreditCard.cardLastFourDigits;
      card.ccType = this.existingCreditCard.cardType;
    }
    if (this.getCustomerInfo()) {
      if (this.getCustomerInfo().email) card.email = this.getCustomerInfo().email;
      if (this.getCustomerInfo().phone) card.phone = this.getCustomerInfo().phone;
    }
    if (this.getCardBillingAddress()) {
      if (this.getCardBillingAddress().firstName) card.billingFirstName = this.getCardBillingAddress().firstName;
      if (this.getCardBillingAddress().lastName) card.billingLastName = this.getCardBillingAddress().lastName;
    }
    return card;
  }

  private loadBluesnap(): Promise<any> {
    let BLUESNAP_DOMAIN_PATH = Helpers.isTestSite() ? 'https://sandbox.bluesnap.com' : 'https://ws.bluesnap.com';
    return loadScript(`${BLUESNAP_DOMAIN_PATH}/web-sdk/5/bluesnap.js`, 'bluesnap');
  }

  private loadDeviceDataCheck(): Promise<string> {
    const {cbToken = '', additionalData: {additionalInformation: {bluesnap = {}} = {}} = {}} = this.paymentInfo;
    if (cbToken && bluesnap && bluesnap.fraud && bluesnap.fraud.fraud_session_id) {
      return Promise.resolve(bluesnap.fraud.fraud_session_id);
    }
    if (!this.paymentInfo.card && !this.paymentInfo.cbToken) {
      return Promise.resolve(null);
    }
    return DeviceDataHelpers.getBluesnapSessionId(Helpers.isTestSite());
  }

  private createPfToken(): Promise<any> {
    let body = {};
    if (this.paymentInfo && this.paymentInfo.additionalData && this.paymentInfo.additionalData.vaultId) {
      body = {
        referenceId: this.paymentInfo.additionalData.vaultId,
      };
    }
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.CreateBluesnapPfToken,
          data: constructPaymentIntentApiPayload(this.getPaymentIntent(), body),
        },
        Ids.MASTER_FRAME,
        {timeout: 120000}
      )
    );
  }

  private logtoKVL(error) {
    this.kvl({
      ...gwJsonify(error),
      action: 'gateway_client_error',
      gw: 'bluesnap',
    });
  }

  private sanitizeBluesnapError(error) {
    this.logtoKVL(error);
    return new CbError(
      {
        type: ErrorType.GatewayError,
        name: error.code,
        message: error.message,
      },
      error
    );
  }
}
