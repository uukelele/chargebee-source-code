import {PaymentInfo} from '@/plugins/payments/direct_debit/types';
import {PaymentMethodType} from '@/internal/payment-intent/types';

export class StripeCommon {
  public static bacsBecs(input: PaymentInfo): object {
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
          accountNumber: input.bankAccount.accountNumber,
          routingNumber: input.bankAccount.routingNumber,
        },
      };
    }
    return out;
  }
}
