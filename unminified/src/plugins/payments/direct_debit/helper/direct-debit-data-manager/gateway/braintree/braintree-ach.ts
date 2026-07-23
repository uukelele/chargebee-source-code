import {AbstractDirectDebitDataManager} from '../../abstract';
import {PaymentMethodType} from '@/internal/payment-intent/types';
import {BankAccountHolderType, PaymentInfo} from '@/plugins/payments/direct_debit/types';
import {requiredAnyOne, requiredAll} from '@/utils/utility-functions';

export class BraintreeACH extends AbstractDirectDebitDataManager {
  public validate(input: PaymentInfo): boolean {
    const {customer: {firstName, lastName, company} = {} as any, bankAccount: {nonce} = {} as any} = input || {};
    return !!(nonce && requiredAnyOne(requiredAll(firstName, lastName), company));
  }

  public transform(input: PaymentInfo): object {
    let out: Record<string, unknown> = {
      paymentMethodType: PaymentMethodType.DIRECT_DEBIT,
    };
    const {customer: {firstName, lastName, company, email, phone} = {}, bankAccount: {nonce, accountHolderType} = {}} =
      input;
    const paymentMethodDetails: Record<string, string> = {
      tempToken: nonce,
      email,
      phone,
    };
    if (accountHolderType === BankAccountHolderType.INDIVIDUAL) {
      paymentMethodDetails.firstName = firstName;
      paymentMethodDetails.lastName = lastName;
    } else if (company) {
      paymentMethodDetails.companyName = company;
    }
    out.paymentMethodDetails = paymentMethodDetails;
    return out;
  }
}
