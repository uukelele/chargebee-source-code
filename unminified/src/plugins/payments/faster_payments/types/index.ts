import {BasePaymentInfo} from '@/hosted_fields/common/base-types';

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
  payTo?: PayToDetails;
  useGateway?: boolean;
}

export type PayToDetails = {
  payId?: string;
  accountNumber?: string;
  bsbNumber?: string;
};

export type BankAccount = {
  iban?: string;
  nameOnAccount?: string;
  routingNumber?: string;
  accountNumber?: string;
  accountType?: BankAccountType;
  accountHolderType?: BankAccountHolderType;
  bankCode?: string;
  countryCode?: string;
  swedishIdentityNumber?: string;
  nonce?: string;
  institutionId?: string;
  payId?: string;
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
