import {AbstractDirectDebitDataManager} from '@/plugins/payments/direct_debit/helper/direct-debit-data-manager/abstract';
import {BankAccount, PaymentInfo} from '@/plugins/payments/direct_debit/types';
import {requiredAll, requiredAnyOne} from '@/utils/utility-functions';
import BankFieldHelper from '@/utils/bank-field-helper';
import {Gateway, PaymentMethodType} from '@/internal/payment-intent/types';

export class AdyenBACS extends AbstractDirectDebitDataManager {
  validate(input: PaymentInfo): boolean {
    let customer = input.customer;
    let bankAccount = input.bankAccount;
    return (
      customer &&
      bankAccount &&
      requiredAll(requiredAnyOne(customer.firstName, customer.lastName), this.validateBankFields(bankAccount))
    );
  }

  private validateBankFields(givenBankAccount: BankAccount): boolean {
    givenBankAccount.countryCode = givenBankAccount.countryCode || 'GB';
    if (!BankFieldHelper.isCountryForBacs(Gateway.ADYEN, givenBankAccount.countryCode)) {
      return false;
    }
    let expectedBankFields = BankFieldHelper.getBacsFields(Gateway.ADYEN, givenBankAccount.countryCode);
    return expectedBankFields.every((field) => givenBankAccount[field]);
  }

  transform(input: PaymentInfo): object {
    let out: any = {
      paymentMethodType: PaymentMethodType.DIRECT_DEBIT,
    };
    if (input.customer) {
      out['paymentMethodDetails'] = {
        firstName: input.customer.firstName,
        lastName: input.customer.lastName,
      };
    }
    if (input.bankAccount) {
      out['paymentMethodDetails'] = {
        ...out['paymentMethodDetails'],
        directDebitBankAccount: {
          accountNumber: input.bankAccount.accountNumber,
          routingNumber: input.bankAccount.routingNumber,
        },
      };
    }
    return out;
  }
}
