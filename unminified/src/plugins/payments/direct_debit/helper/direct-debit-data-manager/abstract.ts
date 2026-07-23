import {PaymentInfo} from '@/plugins/payments/direct_debit/types';

export abstract class AbstractDirectDebitDataManager {
  public abstract validate(input: PaymentInfo): boolean;
  public abstract transform(input: PaymentInfo): object;
}
