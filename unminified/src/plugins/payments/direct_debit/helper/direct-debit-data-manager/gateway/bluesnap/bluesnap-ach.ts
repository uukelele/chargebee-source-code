import {AbstractDirectDebitDataManager} from '../../abstract';
import {PaymentMethodType, Gateway} from '@/internal/payment-intent/types';
import {BankAccount, BankAccountHolderType, PaymentInfo} from '@/plugins/payments/direct_debit/types';
import {requiredAll, requiredAnyOne} from '@/utils/utility-functions';
import BankFieldHelper from '@/utils/bank-field-helper';

export class BluesnapACH extends AbstractDirectDebitDataManager {
  public validate(input: PaymentInfo): boolean {
    let customer = input.customer;
    let bankAccount = input.bankAccount;
    return (
      customer &&
      bankAccount &&
      requiredAll(customer.email, this.validateBankFields(bankAccount)) &&
      requiredAnyOne(requiredAll(customer.firstName, customer.lastName), customer.company)
    );
  }

  private validateBankFields(givenBankAccount: BankAccount): boolean {
    if (!BankFieldHelper.isCountryForAch(Gateway.BLUESNAP, 'US')) {
      return false;
    }
    let expectedBankFields = BankFieldHelper.getAchFields(Gateway.BLUESNAP, 'US');
    return expectedBankFields.every((field) => givenBankAccount[field]);
  }

  public transform(input: PaymentInfo): object {
    let out: any = {
      paymentMethodType: PaymentMethodType.DIRECT_DEBIT,
    };
    if (input.customer) {
      out['customer'] = {
        firstName: input.customer.firstName,
        lastName: input.customer.lastName,
        email: input.customer.email,
        companyName: input.customer.company,
      };
    }
    if (input.bankAccount) {
      out['directDebitBankAccount'] = {
        accountNumber: input.bankAccount.accountNumber,
        routingNumber: input.bankAccount.routingNumber,
        accountType: input.bankAccount.accountType,
        accountHolderType:
          input.bankAccount.accountHolderType ||
          (input.customer.company ? BankAccountHolderType.COMPANY : BankAccountHolderType.INDIVIDUAL),
      };
    }
    return out;
  }
}
