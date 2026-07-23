import {BasePaymentInfo} from '@/hosted_fields/common/base-types';
import {AchVerificationType} from '@/internal/payment-intent/types';

export interface PaymentInfo extends BasePaymentInfo {
  customer?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    company?: string;
    phone?: string;
    billingAddress?: Address;
  };
  bankAccount?: BankAccount;
  plaid?: {
    userId?: string;
    locale?: string;
  };
  useGateway?: boolean;
  mandateText?: string;
  achVerificationType?: AchVerificationType;
}

export type BankAccount = {
  iban?: string;
  bankName?: string;
  nameOnAccount?: string;
  routingNumber?: string;
  accountNumber?: string;
  accountType?: BankAccountType;
  accountHolderType?: BankAccountHolderType;
  bankCode?: string;
  branchCode?: string;
  countryCode?: string;
  swedishIdentityNumber?: string;
  nonce?: string;
  suffix?: string;
};

export enum BankAccountType {
  CHECKING = 'CHECKING',
  SAVINGS = 'SAVINGS',
  BUSINESS_CHECKING = 'BUSINESS_CHECKING',
  CURRENT = 'CURRENT',
}

export enum BankAccountHolderType {
  INDIVIDUAL = 'INDIVIDUAL',
  COMPANY = 'COMPANY',
}

export type Address = {
  addressLine1?: string;
  addressLine2?: string;
  addressLine3?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  countryCode?: string;
  zip?: string | number;
};

export type GatewayPaymentInfo = PaymentInfo & {
  payload?: PlaidResponse | any;
};

type PlaidResponse = {
  locale?: string;
  publicToken: string;
  accountId: string;
  plaid: boolean;
};

export type PlaidConfig = {
  userId: string;
  locale: string;
  env: string;
};

export interface BraintreeACHInstance {
  tokenize: (any) => any;
}

export type BraintreeClientInstance = any;
