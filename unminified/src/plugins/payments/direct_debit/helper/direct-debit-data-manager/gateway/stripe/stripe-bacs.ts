import {AbstractDirectDebitDataManager} from '../../abstract';
import {Gateway} from '@/internal/payment-intent/types';
import {BankAccount, PaymentInfo} from '@/plugins/payments/direct_debit/types';
import {requiredAll, requiredAnyOne} from '@/utils/utility-functions';
import BankFieldHelper from '@/utils/bank-field-helper';
import {StripeCommon} from './stripe-common';

export class StripeBACS extends AbstractDirectDebitDataManager {
  public validate(input: PaymentInfo): boolean {
    let customer = input.customer;
    let bankAccount = input.bankAccount;
    return !!(
      customer &&
      bankAccount &&
      requiredAnyOne(requiredAll(customer.firstName, customer.lastName), customer.company) &&
      requiredAll(customer.email, customer.billingAddress) &&
      requiredAll(
        customer.billingAddress.addressLine1,
        customer.billingAddress.city,
        customer.billingAddress.countryCode,
        customer.billingAddress.zip,
        this.validateBankFields(bankAccount)
      )
    );
  }

  private validateBankFields(givenBankAccount: BankAccount): boolean {
    givenBankAccount.countryCode = givenBankAccount.countryCode || 'GB';
    if (!BankFieldHelper.isCountryForBacs(Gateway.STRIPE, givenBankAccount.countryCode)) {
      return false;
    }
    let expectedBankFields = BankFieldHelper.getBacsFields(Gateway.STRIPE, givenBankAccount.countryCode);
    return expectedBankFields.every((field) => givenBankAccount[field]);
  }

  public transform(input: PaymentInfo): object {
    return StripeCommon.bacsBecs(input);
  }
}
