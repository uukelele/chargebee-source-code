import CommonDirectDebitHandler from '@/plugins/payments/direct_debit/handlers/common';
import {PaymentOptions} from '@/hosted_fields/common/base-types';
import Errors, {CbError, ErrorType} from '@/hosted_fields/common/errors';
import {PaymentAttemptStatus, Gateway} from '@/internal/payment-intent/types';
import BraintreeUtils from '@/utils/payments/braintree';
import {
  BraintreeClientInstance,
  BraintreeACHInstance,
  BankAccountHolderType,
  PaymentInfo,
  BankAccount,
} from '@/plugins/payments/direct_debit/types';
import {gwJsonify, requiredAll, requiredAnyOne, isObjectEmpty} from '@/utils/utility-functions';
import BankFieldHelper from '@/utils/bank-field-helper';
import t from '@/hosted_fields/common/locale';

export default class BraintreeAchDirectDebitHandler extends CommonDirectDebitHandler {
  achInstance: BraintreeACHInstance;
  clientInstance: BraintreeClientInstance;

  public validateTempTokenOptions(input: PaymentInfo): Promise<boolean> {
    const {
      customer: {firstName, lastName, company, billingAddress},
      bankAccount = {},
      mandateText,
    } = input || {};
    if (
      requiredAll(mandateText, this.validateBankFields(bankAccount), !isObjectEmpty(billingAddress)) &&
      requiredAnyOne(requiredAll(firstName, lastName), company)
    ) {
      return Promise.resolve(true);
    } else {
      return Promise.reject(new CbError(Errors.missingDirectDebitPaymentInfo));
    }
  }

  private validateBankFields(givenBankAccount: BankAccount): boolean {
    if (!BankFieldHelper.isCountryForAch(Gateway.BRAINTREE, 'US')) {
      return false;
    }
    let expectedBankFields = BankFieldHelper.getAchFields(Gateway.BRAINTREE, 'US');
    return expectedBankFields.every((field) => givenBankAccount[field]);
  }

  handlePayment(options: PaymentOptions | any = {}): Promise<any> {
    const {
      customer: {firstName, lastName, company, email, phone, billingAddress = {}},
      bankAccount: {accountNumber, routingNumber, accountType, accountHolderType = ''},
      mandateText,
    } = options.paymentInfo || {};
    const {addressLine1, addressLine2, city, state, stateCode, zip} = billingAddress;
    const _accountHolderType = accountHolderType.toUpperCase();
    return this.validateTempTokenOptions(options.paymentInfo || {})
      .then(() => {
        const isIndividualAccountHolder = _accountHolderType === BankAccountHolderType.INDIVIDUAL;
        const bankDetails: Record<string, unknown> = {
          accountNumber,
          routingNumber,
          accountType,
          ownershipType: isIndividualAccountHolder ? 'personal' : 'business',
          billingAddress: {
            streetAddress: addressLine1,
            extendedAddress: addressLine2,
            locality: city,
            region: stateCode || state,
            postalCode: zip,
          },
        };

        if (isIndividualAccountHolder) {
          bankDetails.firstName = firstName;
          bankDetails.lastName = lastName;
        } else {
          bankDetails.businessName = company;
        }
        return this.getTokenizedData({bankDetails, mandateText});
      })
      .then((tokenizedData = {}) => {
        const {nonce} = tokenizedData;
        return this.initiateAuthorization(
          {
            customer: {
              firstName,
              lastName,
              company,
              email,
              phone,
            },
            bankAccount: {
              nonce,
              accountHolderType: _accountHolderType,
            },
          },
          options.callbacks
        );
      });
  }

  getTokenizedData({bankDetails, mandateText}) {
    return this.getBraintreeAchInstance()
      .then((usBankAccountInstance) =>
        usBankAccountInstance.tokenize({
          bankDetails,
          mandateText,
        })
      )
      .catch((err) => {
        err = this.sanitizeError(err);
        throw err;
      });
  }

  handlePaymentAttemptStatus(paymentAttemptStatus: PaymentAttemptStatus): Promise<any> {
    switch (paymentAttemptStatus) {
      case PaymentAttemptStatus.AUTHORIZED:
        this.setPaymentIntent({
          ...this.getPaymentIntent(),
          payer_info: {...this.getPayerInfo()},
        });
        this.callbackHandler.triggerSuccessCallback();
        return Promise.resolve(this.getPaymentIntent());
      default:
        return super.handlePaymentAttemptStatus(paymentAttemptStatus);
    }
  }

  getPayerInfo(): any {
    let payerInfo: any = {};
    const payload = this.getPaymentAttempt().action_payload;
    if (payload) {
      payerInfo.bank = {
        bank_name: payload.bank_name,
        last4: payload.last4,
      };
    }
    return payerInfo;
  }

  getBraintreeAchInstance(): Promise<BraintreeACHInstance> {
    return (
      BraintreeUtils.initializeBraintreeClient(this.getPaymentIntent())
        .then((clientInstance) => {
          this.clientInstance = clientInstance;
        })
        // Create braintree ach instance
        .then(() => this.createACHInstance())
    );
  }

  createACHInstance(): Promise<BraintreeACHInstance> {
    return BraintreeUtils.loadAchJs()
      .then(() =>
        BraintreeUtils.braintree().usBankAccount.create({
          client: this.clientInstance,
        })
      )
      .then((usBankAccountInstance: BraintreeACHInstance) => {
        this.achInstance = usBankAccountInstance;
        return usBankAccountInstance;
      });
  }

  sanitizeError(error) {
    this.kvl({
      ...gwJsonify(error),
      action: 'gateway_client_error',
      gw: 'braintree',
    });
    return new CbError(
      {
        type: ErrorType.GatewayError,
        name: error.code,
        message: t('displayError.common'),
      },
      error
    );
  }
}
