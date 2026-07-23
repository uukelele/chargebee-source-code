import {PaymentAttemptStatus, PaymentAttempt, PaymentMethodType, Gateway} from '@/internal/payment-intent/types';
import SepaInstantTransferHandler from '@/plugins/payments/sepa_instant_transfer/handlers';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {requiredAll, requiredAnyOne} from '@/utils/utility-functions';
import {PaymentInfo, BankAccount} from '../../faster_payments/types';
import BankFieldHelper from '@/utils/bank-field-helper';

export default class GocardlessSepaInstantTransferHandler extends SepaInstantTransferHandler {
  constructor(handler: SepaInstantTransferHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
  }

  validate(): Promise<boolean> {
    if (this._validate(this.paymentInfo)) {
      return Promise.resolve(true);
    } else {
      return Promise.reject(new CbError(Errors.invalidOrMissingSepaInstantTransferPaymentInfo));
    }
  }

  initPayment() {
    return Promise.resolve(this._transform(this.paymentInfo));
  }

  private redirectToBank(paymentAttempt: PaymentAttempt): Promise<any> {
    const rawData = paymentAttempt.action_payload;

    if (this.isRedirectMode && this.getPaymentIntent().success_url) {
      window.location.href = rawData.redirectUrl;
      return new Promise(() => {});
    }

    this.windowManager.loadURL(rawData.redirectUrl);
    this.windowManager.watchClose(() => this.callbackHandler.triggerCancelCallback());

    return this.pollForAuthCompletion();
  }

  handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_REDIRECTION: {
        return this.redirectToBank(paymentAttempt).then((data) => {
          this.setPaymentIntent(data.payment_intent);
          return this.handlePaymentAttemptStatus(this.getPaymentAttempt().status);
        });
      }
      default: {
        return Promise.resolve(true);
      }
    }
  }

  _validate(input: PaymentInfo): boolean {
    if (input.useGateway) {
      return true;
    }
    let customer = input.customer;
    let billingAddress = customer && customer.billingAddress;
    let bankAccount = input.bankAccount;
    return (
      customer &&
      requiredAll(customer.email) &&
      requiredAnyOne(customer.firstName, customer.lastName, customer.company) &&
      requiredAnyOne(bankAccount.iban, requiredAll(this._validateBankFields(bankAccount), bankAccount.institutionId)) &&
      requiredAll(
        billingAddress,
        billingAddress.addressLine1,
        billingAddress.city,
        billingAddress.countryCode,
        billingAddress.zip
      )
    );
  }

  private _validateBankFields(givenBankAccount: BankAccount): boolean {
    if (!BankFieldHelper.isCountryForSepa(Gateway.GOCARDLESS, givenBankAccount.countryCode)) {
      return false;
    }
    let expectedBankFields = BankFieldHelper.getSepaFields(Gateway.GOCARDLESS, givenBankAccount.countryCode);
    return expectedBankFields.every((field) => givenBankAccount[field]);
  }

  _transform(input: PaymentInfo): object {
    let out: any = {
      paymentMethodType: PaymentMethodType.SEPA_INSTANT_TRANSFER,
    };
    if (input.customer) {
      out['paymentMethodDetails'] = {
        firstName: input.customer.firstName,
        lastName: input.customer.lastName,
        companyName: input.customer.company,
        email: input.customer.email,
        billingAddress: input.customer.billingAddress,
      };
    }
    if (input.useGateway) {
      out['requiresRedirection'] = true;
    } else if (input.bankAccount) {
      out['paymentMethodDetails'] = {
        ...out['paymentMethodDetails'],
        directDebitBankAccount: {
          iban: input.bankAccount.iban,
          accountNumber: input.bankAccount.accountNumber,
          routingNumber: input.bankAccount.routingNumber,
          bankCode: input.bankAccount.bankCode,
          accountCountry: input.bankAccount.countryCode,
          institutionName: input.bankAccount.institutionId,
        },
      };
    }
    return out;
  }
}
