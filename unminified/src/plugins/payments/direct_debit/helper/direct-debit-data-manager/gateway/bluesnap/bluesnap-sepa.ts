import {AbstractDirectDebitDataManager} from '../../abstract';
import {PaymentMethodType} from '@/internal/payment-intent/types';
import {PaymentInfo} from '@/plugins/payments/direct_debit/types';
import {requiredAll} from '@/utils/utility-functions';

export class BluesnapSEPA extends AbstractDirectDebitDataManager {
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
      out['customer'] = {
        firstName: input.customer.firstName,
        lastName: input.customer.lastName,
        email: input.customer.email,
      };
    }
    if (input.bankAccount) {
      out['directDebitBankAccount'] = {
        iban: input.bankAccount.iban,
      };
    }
    return out;
  }
}
