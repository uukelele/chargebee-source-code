import {AbstractDirectDebitDataManager} from '@/plugins/payments/direct_debit/helper/direct-debit-data-manager/abstract';
import {PaymentInfo} from '@/plugins/payments/direct_debit/types';
import {PaymentMethodType} from '@/internal/payment-intent/types';
import {getBeneficiaryName, requiredAll, requiredAnyOne} from '@/utils/utility-functions';

export class ChargebeePaymentsSepa extends AbstractDirectDebitDataManager {
  validate(input: PaymentInfo): boolean {
    let bankAccount = input.bankAccount;
    let customer = input.customer;
    return (
      requiredAll(bankAccount && bankAccount.nameOnAccount && bankAccount.iban) ||
      requiredAll(
        customer &&
          bankAccount &&
          bankAccount.iban &&
          requiredAnyOne(bankAccount.nameOnAccount, customer.firstName, customer.lastName)
      )
    );
  }

  transform(input: PaymentInfo): object {
    let params = {
      paymentMethodType: PaymentMethodType.DIRECT_DEBIT,
    };
    if (input.bankAccount) {
      params['directDebitBankAccount'] = {
        beneficiaryName: getBeneficiaryName(input),
        iban: input.bankAccount.iban,
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
