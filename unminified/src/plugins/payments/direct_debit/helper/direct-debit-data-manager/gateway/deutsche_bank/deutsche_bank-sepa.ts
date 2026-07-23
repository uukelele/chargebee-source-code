import {AbstractDirectDebitDataManager} from '../../abstract';
import {PaymentMethodType} from '@/internal/payment-intent/types';
import {PaymentInfo} from '@/plugins/payments/direct_debit/types';
import {requiredAll} from '@/utils/utility-functions';

export class DeutscheBankSEPA extends AbstractDirectDebitDataManager {
  public validate(input: PaymentInfo): boolean {
    let customer = input.customer;
    let bankAccount = input.bankAccount;
    return customer && bankAccount && requiredAll(customer.firstName, customer.lastName, bankAccount.iban);
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
    if (input.bankAccount) {
      out['paymentMethodDetails'] = {
        ...out['paymentMethodDetails'],
        directDebitBankAccount: {
          iban: input.bankAccount.iban,
          bankCode: input.bankAccount.bankCode,
          bankName: input.bankAccount.bankName,
        },
      };
    }
    return out;
  }
}
