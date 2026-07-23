import {AbstractDirectDebitDataManager} from '../../abstract';
import {Gateway} from '@/internal/payment-intent/types';
import {BankAccount, PaymentInfo} from '@/plugins/payments/direct_debit/types';
import {requiredAll, requiredAnyOne, removeNullUndefinedEmpty} from '@/utils/utility-functions';
import BankFieldHelper from '@/utils/bank-field-helper';
import {StripeCommon} from './stripe-common';

export class StripeBECS extends AbstractDirectDebitDataManager {
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
    givenBankAccount.countryCode = givenBankAccount.countryCode || 'AU';
    if (!BankFieldHelper.isCountryForBecs(Gateway.STRIPE, givenBankAccount.countryCode)) {
      return false;
    }
    let expectedBankFields = BankFieldHelper.getBecsFields(Gateway.STRIPE, givenBankAccount.countryCode);
    return expectedBankFields.every((field) => givenBankAccount[field]);
  }

  public transform(input: PaymentInfo): object {
    return removeNullUndefinedEmpty(StripeCommon.bacsBecs(input));
  }
}
