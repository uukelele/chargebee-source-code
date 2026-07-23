import {AbstractDirectDebitDataManager} from '../../abstract';
import {PaymentMethodType, Gateway} from '@/internal/payment-intent/types';
import {BankAccount, PaymentInfo} from '@/plugins/payments/direct_debit/types';
import {requiredAll, requiredAnyOne} from '@/utils/utility-functions';
import BankFieldHelper from '@/utils/bank-field-helper';

export class GocardlessPAD extends AbstractDirectDebitDataManager {
  public validate(input: PaymentInfo): boolean {
    if (input.useGateway) {
      return true;
    }
    let customer = input.customer;
    let bankAccount = input.bankAccount;
    return (
      customer &&
      requiredAll(customer.email) &&
      requiredAnyOne(customer.firstName, customer.lastName, customer.company) &&
      this.validateBankFields(bankAccount)
    );
  }

  private validateBankFields(givenBankAccount: BankAccount): boolean {
    if (!BankFieldHelper.isCountryForPad(Gateway.GOCARDLESS, givenBankAccount.countryCode)) {
      return false;
    }
    let expectedBankFields = BankFieldHelper.getPadFields(Gateway.GOCARDLESS, givenBankAccount.countryCode);
    return expectedBankFields.every((field) => givenBankAccount[field]);
  }

  public transform(input: PaymentInfo): object {
    let out: any = {
      paymentMethodType: PaymentMethodType.DIRECT_DEBIT,
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
    if (!!input.useGateway) {
      out['requiresRedirection'] = true;
    } else if (input.bankAccount) {
      out['paymentMethodDetails'] = {
        ...out['paymentMethodDetails'],
        directDebitBankAccount: {
          accountNumber: input.bankAccount.accountNumber,
          routingNumber: input.bankAccount.routingNumber,
          bankCode: input.bankAccount.bankCode,
          accountCountry: input.bankAccount.countryCode,
        },
      };
    }
    return out;
  }
}
