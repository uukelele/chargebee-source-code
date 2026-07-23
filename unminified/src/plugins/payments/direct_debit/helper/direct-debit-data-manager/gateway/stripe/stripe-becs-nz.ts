import {AbstractDirectDebitDataManager} from '../../abstract';
import {Gateway, PaymentMethodType} from '@/internal/payment-intent/types';
import {BankAccount, PaymentInfo} from '@/plugins/payments/direct_debit/types';
import {requiredAll, requiredAnyOne, removeNullUndefinedEmpty} from '@/utils/utility-functions';
import BankFieldHelper from '@/utils/bank-field-helper';

export class StripeBECSNZ extends AbstractDirectDebitDataManager {
  public validate(input: PaymentInfo): boolean {
    let customer = input.customer;
    let bankAccount = input.bankAccount;
    return !!(
      customer &&
      bankAccount &&
      requiredAnyOne(requiredAll(customer.firstName, customer.lastName), customer.company) &&
      requiredAll(customer.email, this.validateBankFields(bankAccount))
    );
  }

  private validateBankFields(givenBankAccount: BankAccount): boolean {
    givenBankAccount.countryCode = givenBankAccount.countryCode || 'NZ';
    if (!BankFieldHelper.isCountryForBecsNZ(Gateway.STRIPE, givenBankAccount.countryCode)) {
      return false;
    }
    let expectedBankFields = BankFieldHelper.getBecsFieldsNZ(Gateway.STRIPE, givenBankAccount.countryCode);
    return expectedBankFields.every((field) => givenBankAccount[field]);
  }

  public transform(input: PaymentInfo): object {
    const payload: Record<string, unknown> = {
      paymentMethodType: PaymentMethodType.DIRECT_DEBIT,
    };
    const details = this.buildPaymentMethodDetails(input);
    if (details !== null) {
      payload.paymentMethodDetails = details;
    }
    return removeNullUndefinedEmpty(payload);
  }

  private buildPaymentMethodDetails(input: PaymentInfo): Record<string, unknown> | null {
    const {customer, bankAccount} = input;
    if (!customer && !bankAccount) {
      return null;
    }
    const details: Record<string, unknown> = {};
    if (customer) {
      details.firstName = customer.firstName;
      details.lastName = customer.lastName;
      details.companyName = customer.company;
      details.email = customer.email;
      details.billingAddress = customer.billingAddress;
    }
    if (bankAccount) {
      details.directDebitBankAccount = {
        bankCode: bankAccount.bankCode,
        branchCode: bankAccount.branchCode,
        accountNumber: bankAccount.accountNumber,
        suffix: bankAccount.suffix,
      };
    }
    return details;
  }
}
