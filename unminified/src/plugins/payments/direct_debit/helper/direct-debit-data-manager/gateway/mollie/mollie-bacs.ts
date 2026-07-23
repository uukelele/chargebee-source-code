import {AbstractDirectDebitDataManager} from '../../abstract';
import {PaymentMethodType} from '@/internal/payment-intent/types';
import {PaymentInfo} from '@/plugins/payments/direct_debit/types';

export class MollieBACS extends AbstractDirectDebitDataManager {
  public validate(input: PaymentInfo): boolean {
    return true;
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
    out['requiresRedirection'] = true;

    return out;
  }
}
