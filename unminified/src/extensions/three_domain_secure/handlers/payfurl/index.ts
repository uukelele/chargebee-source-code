import AbstractThreeDSecureHandler from '@/extensions/three_domain_secure/handlers/abstract';
import {
  PaymentAttempt,
  PaymentAttemptStatus,
  Gateway,
  ConfirmApiInputPayload,
  PaymentInfo,
} from '@/extensions/three_domain_secure/common/types';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {validateRawCardDetails, loadScriptUsingPredicate} from '@/extensions/three_domain_secure/common/utils';
import Helpers from '@/helpers';
import {getCurrencyDivisor} from '@/utils/utility-functions';
import {
  isDocumentIdValidationRequired as checkDocumentIdValidationRequired,
  validateDocumentId as validateDocumentIdUtil,
} from '@/extensions/three_domain_secure/common/validators/document-validator';

export default class Payfurl3DSHandler extends AbstractThreeDSecureHandler {
  private payfurlInstance: any;
  private pubKey: string;
  private providerId: string;
  private merchantId: string;
  private threeDsEnabled: boolean;

  validate(): boolean {
    const hasRawCard = !!this.paymentInfo.card;
    const hasCbToken = !!this.paymentInfo.cbToken;
    const hasReferenceId = !!this.getReferenceId();
    const hadPaymentComponent = !!this.paymentInfo.paymentComponent;

    if (!hasRawCard && !hasReferenceId && !hasCbToken && !hadPaymentComponent) {
      throw new CbError(Errors.missingPayfurlPaymentInfo);
    }

    if (hasRawCard) {
      validateRawCardDetails(this.paymentInfo.card);
      if (this.isDocumentIdValidationRequired()) {
        this.validateDocumentId();
      }
    }

    return true;
  }

  isDocumentIdValidationRequired(): boolean {
    return checkDocumentIdValidationRequired(this.getPaymentIntent().gateway);
  }

  validateDocumentId(): boolean {
    return validateDocumentIdUtil(this.paymentInfo);
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
      if (this.threeDsEnabled === true) {
        return this.threeDsCardFlow();
      }
      return this.rawCardFlow();
    } else if (this.getReferenceId()) {
      return this.referenceIdFlow();
    } else if (this.paymentInfo.cbToken) {
      return this.cbTokenFlow();
    } else if (this.paymentInfo.paymentComponent) {
      if (this.threeDsEnabled === true) {
        return this.threeDsPaymentComponentFlow();
      }
      return this.rawPaymentComponentFlow();
    }
  }

  private rawPaymentComponentFlow(): Promise<any> {
    return this.getConfirmPayload({paymentComponent: this.paymentInfo.paymentComponent});
  }

  private threeDsPaymentComponentFlow(): Promise<any> {
    return this.tokenizePaymentComponentCard({
      paymentIntent: this.getPaymentIntent(),
      paymentComponent: this.paymentInfo.paymentComponent,
      additionalData: this.paymentInfo.additionalData,
    }).then((payload: PaymentInfo) => {
      return new Promise((resolve, reject) => {
        this.payfurlInstance.onFailure((data) => {
          this.kvl({
            action: 'payfurl_3ds',
            result: 'failed',
          });
          reject(data.error);
        });
        this.payfurlInstance.onSuccess((data) => {
          this.kvl({
            action: 'payfurl_3ds',
            result: 'success',
          });
          resolve(payload.additionalData.vaultId);
        });
        const {additionalData: {customer: {email = ''}} = {}} = this.paymentInfo;

        const paymentIntent = this.getPaymentIntent();
        this.payfurlInstance.addThreeDsWithToken(
          payload.additionalData.vaultId,
          email,
          this.getAmount(),
          paymentIntent.currency_code
        );
      }).then((token: string) => this.getConfirmPayload({orchestratorTempToken: token}));
    });
  }

  threeDsCardFlow(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.payfurlInstance.onSuccess((data) => {
        this.kvl({
          action: 'payfurl_3ds',
          result: 'success',
        });
        if (data.token) {
          resolve(data.token);
        }
      });

      this.payfurlInstance.onFailure((data) => {
        this.kvl({
          action: 'payfurl_3ds',
          result: 'failed',
        });
        reject(data.error);
      });

      const paymentIntent = this.getPaymentIntent();

      const {
        additionalData: {customer: {firstName: customerFname = '', lastName: customerLname = '', email = ''}} = {},
        card: {firstName = '', lastName = '', number = '', cvv = '', expiryMonth = '', expiryYear = ''} = {},
      } = this.paymentInfo;

      let name = firstName ? `${firstName} ${lastName}` : lastName;
      if (!name) name = customerFname ? `${customerFname} ${customerLname}` : customerLname;
      const expiry = `${expiryMonth}/${expiryYear.toString().slice(-2)}`;

      this.payfurlInstance.tokeniseWith3Ds(
        null,
        this.providerId,
        this.paymentInfo.card.number,
        expiry,
        name,
        this.paymentInfo.card.cvv,
        email,
        this.getAmount(),
        paymentIntent.currency_code
      );
    }).then((token: string) => this.getConfirmPayload({orchestratorTempToken: token}));
  }

  rawCardFlow(): Promise<any> {
    return this.getConfirmPayload({card: this.paymentInfo.card});
  }

  referenceIdFlow(): Promise<any> {
    return this.getConfirmPayload({});
  }

  cbTokenFlow(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.fetchGatewayToken({cbToken: this.paymentInfo.cbToken}).then((tokenResponse) => {
        this.payfurlInstance.onFailure((message) => {
          reject(message.error);
        });
        this.payfurlInstance.onSuccess((message) => {
          resolve(tokenResponse.token.id_at_vault);
        });
        const {additionalData: {customer: {email = ''}} = {}} = this.paymentInfo;

        const paymentIntent = this.getPaymentIntent();
        this.payfurlInstance.addThreeDsWithToken(
          tokenResponse.token.id_at_vault,
          email,
          this.getAmount(),
          paymentIntent.currency_code
        );
      });
    }).then((token: string) => this.getConfirmPayload({orchestratorTempToken: token}));
  }

  getAmount() {
    const currencyDivisor = getCurrencyDivisor(this.getPaymentIntent().currency_code);
    return (this.getPaymentIntent().amount / currencyDivisor).toFixed(2);
  }

  getConfirmPayload(paymentData: any): Promise<any> {
    const cardBillingAddress = this.getCardBillingAddress() || {};
    const billingAddress = this.getCustomerBillingAddress() || {};
    var documentNumber, documentType;

    if (this.paymentInfo.additionalData && this.paymentInfo.additionalData.document) {
      documentNumber = this.paymentInfo.additionalData.document.number;
      documentType = this.paymentInfo.additionalData.document.type;
    }
    let payload = {
      paymentMethodType: 'card',
      paymentMethodDetails: {
        ...paymentData,
        ...this.getCustomerInfo(),
        firstName: cardBillingAddress.firstName,
        lastName: cardBillingAddress.lastName,
        billingAddress: this.getCardBillingAddress(),
      },
      shippingAddress: this.getShippingAddress(),
      additionalInfo: {
        details: {
          merchant_id: this.merchantId,
          document_id: documentNumber,
        },
      },
      customer: {
        firstName: billingAddress.firstName,
        lastName: billingAddress.lastName,
        ...this.getCustomerInfo(),
        billingAddress,
      },
    };
    return Promise.resolve(payload);
  }

  protected handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    return Promise.resolve(true).then(() => {
      if (paymentAttempt.status == PaymentAttemptStatus.REQUIRES_CHALLENGE) {
        this.callChange();
      } else if (paymentAttempt.status == PaymentAttemptStatus.AUTHORIZED) {
        return true;
      } else {
        throw this.intentError();
      }
    });
  }

  private getPayfurl(): any {
    return window['payfurl'];
  }

  private fetchPubKey(): Promise<string> {
    if (this.pubKey) {
      return Promise.resolve(this.pubKey);
    }
    return this.fetchGatewayCredential().then((data) => {
      this.pubKey = data.publishable_key;
      this.providerId = data.provider_id;
      this.merchantId = data.merchant_id;
      this.threeDsEnabled = data.threeDsEnabled;
      return Promise.resolve(this.pubKey);
    });
  }

  checkNLoadScript() {
    return new Promise((resolve, reject) => {
      Promise.all([
        this.fetchPubKey(),
        loadScriptUsingPredicate('https://assets.payfurl.com/v4.7.0.1193/js/payfurl.js', () => !!this.getPayfurl()),
      ])
        .then((args) => {
          const env = Helpers.isTestSite(Helpers.getCbInstance().site) ? 'sandbox' : 'production';
          const pubKey = args[0];
          this.payfurlInstance = this.getPayfurl().init(env, pubKey);
          resolve(true);
        })
        .catch((error) => {
          reject(new CbError(error));
        });
    });
  }
}
