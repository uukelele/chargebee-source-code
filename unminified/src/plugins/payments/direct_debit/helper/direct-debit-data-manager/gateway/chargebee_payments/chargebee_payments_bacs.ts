import {AbstractDirectDebitDataManager} from '@/plugins/payments/direct_debit/helper/direct-debit-data-manager/abstract';
import {BankAccount, PaymentInfo} from '@/plugins/payments/direct_debit/types';
import BankFieldHelper from '@/utils/bank-field-helper';
import {Gateway, PaymentMethodType} from '@/internal/payment-intent/types';
import {getBeneficiaryName, requiredAll, requiredAnyOne} from '@/utils/utility-functions';

export class ChargebeePaymentsBacs extends AbstractDirectDebitDataManager {
  validate(input: PaymentInfo): boolean {
    let bankAccount = input.bankAccount;
    let customer = input.customer;
    return (
      requiredAll(bankAccount && bankAccount.nameOnAccount && this.validateBankFields(bankAccount)) ||
      requiredAll(
        customer &&
          bankAccount &&
          this.validateBankFields(bankAccount) &&
          requiredAnyOne(bankAccount.nameOnAccount, customer.firstName, customer.lastName)
      )
    );
  }

  private validateBankFields(givenBankAccount: BankAccount): boolean {
    givenBankAccount.countryCode = givenBankAccount.countryCode || 'GB';
    if (!BankFieldHelper.isCountryForBacs(Gateway.CHARGEBEE_PAYMENTS, givenBankAccount.countryCode)) {
      return false;
    }
    let expectedBankFields = BankFieldHelper.getBacsFields(Gateway.CHARGEBEE_PAYMENTS, givenBankAccount.countryCode);
    return expectedBankFields.every((field) => givenBankAccount[field]);
  }

  transform(input: PaymentInfo): object {
    let params = {
      paymentMethodType: PaymentMethodType.DIRECT_DEBIT,
    };
    if (input.bankAccount) {
      params['directDebitBankAccount'] = {
        beneficiaryName: getBeneficiaryName(input),
        accountNumber: input.bankAccount.accountNumber,
        routingNumber: input.bankAccount.routingNumber,
      };
    }

    if (input.customer) {
      params['customer'] = {
        firstName: input.customer.firstName,
        lastName: input.customer.lastName,
        email: input.customer.email,
        phone: input.customer.phone,
        billingAddress: input.customer.billingAddress,
      };
    }

    return params;
  }
}
