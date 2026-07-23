import {PaymentInfo, BankAccount, BankAccountHolderType} from '../../types';
import {Gateway, PaymentIntent, PaymentMethodType} from '@/internal/payment-intent/types';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {AbstractDirectDebitDataManager} from './abstract';

// Import legacy gateway-specific implementations
import {GocardlessSEPA} from './gateway/gocardless/gocardless-sepa';
import {GocardlessBACS} from './gateway/gocardless/gocardless-bacs';
import {GocardlessBECS} from './gateway/gocardless/gocardless-becs';
import {GocardlessBECSNZ} from './gateway/gocardless/gocardless-becs-nz';
import {GocardlessPAD} from './gateway/gocardless/gocardless-pad';
import {GocardlessACH} from './gateway/gocardless/gocardless-ach';
import {GocardlessAUTOGIRO} from './gateway/gocardless/gocardless-autogiro';
import {BluesnapSEPA} from './gateway/bluesnap/bluesnap-sepa';
import {CheckoutComSEPA} from './gateway/checkout_com/checkout_com-sepa';
import {BluesnapACH} from './gateway/bluesnap/bluesnap-ach';
import {BraintreeACH} from './gateway/braintree/braintree-ach';
import {StripeBACS} from './gateway/stripe/stripe-bacs';
import {StripeBECS} from './gateway/stripe/stripe-becs';
import {StripeBECSNZ} from './gateway/stripe/stripe-becs-nz';
import {AdyenBACS} from './gateway/adyen/adyen-bacs';
import {ChargebeePaymentsBacs} from './gateway/chargebee_payments/chargebee_payments_bacs';
import {ChargebeePaymentsSepa} from './gateway/chargebee_payments/chargbee_payments_sepa';
import {EzidebitBECS} from './gateway/ezidebit/ezidebit-becs';
import {EzidebitBECSNZ} from './gateway/ezidebit/ezidebit-becs-nz';
import {DeutscheBankSEPA} from './gateway/deutsche_bank/deutsche_bank-sepa';
import {MollieBACS} from './gateway/mollie/mollie-bacs';

// Legacy gateway mapper for backward compatibility
const LEGACY_MAPPER = {
  gocardless: {
    EUR: GocardlessSEPA,
    GBP: GocardlessBACS,
    SEK: GocardlessAUTOGIRO,
    USD: GocardlessACH,
    AUD: GocardlessBECS,
    NZD: GocardlessBECSNZ,
    CAD: GocardlessPAD,
  },
  bluesnap: {
    EUR: BluesnapSEPA,
    USD: BluesnapACH,
  },
  checkout_com: {
    EUR: CheckoutComSEPA,
  },
  braintree: {
    USD: BraintreeACH,
  },
  stripe: {
    GBP: StripeBACS,
    AUD: StripeBECS,
    NZD: StripeBECSNZ,
  },
  adyen: {
    GBP: AdyenBACS,
  },
  chargebee_payments: {
    EUR: ChargebeePaymentsSepa,
    GBP: ChargebeePaymentsBacs,
  },
  ezidebit: {
    AUD: EzidebitBECS,
    NZD: EzidebitBECSNZ,
  },
  deutsche_bank: {
    EUR: DeutscheBankSEPA,
  },
  mollie: {
    GBP: MollieBACS,
  },
};

// Configuration for supported schemes and their requirements
const DIRECT_DEBIT_SCHEMES = {
  SEPA: {
    currency: 'EUR',
    requiredFields: ['iban'],
    optionalFields: ['bankCode'],
    customerRequiredFields: {
      individual: ['firstName', 'lastName'],
      company: ['company'],
      common: ['email'],
    },
  },
  ACH: {
    currency: 'USD',
    requiredFields: ['accountNumber', 'routingNumber', 'accountType', 'accountHolderType'],
    optionalFields: [],
    customerRequiredFields: {
      individual: ['firstName', 'lastName'],
      company: ['company'],
      common: ['email'],
    },
  },
};

export class DirectDebitDataManager {
  private gateway: Gateway;
  private currency: string;
  private scheme: string;
  private ddDataManager: AbstractDirectDebitDataManager | null = null;
  private useLegacyFlow: boolean = false;

  constructor(gateway: Gateway, currency: string) {
    this.gateway = gateway;
    this.currency = currency;

    // Check if we should use legacy flow
    if (LEGACY_MAPPER[gateway] && LEGACY_MAPPER[gateway][currency]) {
      this.useLegacyFlow = true;
      this.ddDataManager = new LEGACY_MAPPER[gateway][currency]();
    } else {
      // Use new common flow
      this.scheme = this.determineScheme(currency);
    }
  }

  private determineScheme(currency: string): string {
    // Find the scheme that matches the currency
    const scheme = Object.entries(DIRECT_DEBIT_SCHEMES).find(([_, config]) => config.currency === currency);

    if (!scheme) {
      throw new CbError(Errors.unsupportedDirectDebitScheme);
    }

    return scheme[0];
  }

  validatePaymentInfo(paymentInfo: PaymentInfo): boolean {
    // Use legacy flow if available
    if (this.useLegacyFlow && this.ddDataManager) {
      return this.ddDataManager.validate(paymentInfo);
    }

    // Otherwise use new common flow
    if (!paymentInfo.bankAccount) {
      return false;
    }

    const schemeConfig = DIRECT_DEBIT_SCHEMES[this.scheme];

    // Check required bank account fields
    const hasRequiredBankFields = schemeConfig.requiredFields.every(
      (field) => paymentInfo.bankAccount[field] && paymentInfo.bankAccount[field].trim() !== ''
    );

    if (!hasRequiredBankFields) {
      return false;
    }

    // Check required customer fields based on account holder type
    if (paymentInfo.bankAccount.accountHolderType) {
      const accountHolderType = paymentInfo.bankAccount.accountHolderType;
      const customerType = accountHolderType.toUpperCase() === BankAccountHolderType.COMPANY ? 'company' : 'individual';

      // Check common required fields
      const hasCommonRequiredFields = schemeConfig.customerRequiredFields.common.every(
        (field) => paymentInfo.customer && paymentInfo.customer[field] && paymentInfo.customer[field].trim() !== ''
      );

      if (!hasCommonRequiredFields) {
        return false;
      }

      // Check type-specific required fields
      const hasTypeRequiredFields = schemeConfig.customerRequiredFields[customerType].every(
        (field) => paymentInfo.customer && paymentInfo.customer[field] && paymentInfo.customer[field].trim() !== ''
      );

      if (!hasTypeRequiredFields) {
        return false;
      }
    }

    // Additional scheme-specific validations
    switch (this.scheme) {
      case 'SEPA':
        return this.validateSepa(paymentInfo.bankAccount);
      case 'ACH':
        return this.validateAch(paymentInfo.bankAccount);
      default:
        return false;
    }
  }

  transformPaymentInfo(paymentInfo: PaymentInfo): object {
    // Use legacy flow if available
    if (this.useLegacyFlow && this.ddDataManager) {
      return this.ddDataManager.transform(paymentInfo);
    }

    // Otherwise use new common flow
    if (!paymentInfo.bankAccount) {
      throw new CbError(Errors.invalidOrMissingDirectDebitPaymentInfo);
    }

    let out: any = {
      paymentMethodType: PaymentMethodType.DIRECT_DEBIT,
    };

    // Add customer information if available
    if (paymentInfo.customer) {
      out['customer'] = {
        firstName: paymentInfo.customer.firstName,
        lastName: paymentInfo.customer.lastName,
        email: paymentInfo.customer.email,
        companyName: paymentInfo.customer.company,
        phone: paymentInfo.customer.phone,
      };
    }

    // Add bank account information based on scheme
    if (paymentInfo.bankAccount) {
      out['directDebitBankAccount'] = {};

      switch (this.scheme) {
        case 'SEPA':
          out['directDebitBankAccount'] = {
            iban: paymentInfo.bankAccount.iban,
          };
          break;
        case 'ACH':
          out['directDebitBankAccount'] = {
            accountNumber: paymentInfo.bankAccount.accountNumber,
            routingNumber: paymentInfo.bankAccount.routingNumber,
            accountType: paymentInfo.bankAccount.accountType,
            accountHolderType: paymentInfo.bankAccount.accountHolderType,
          };
          break;
        default:
          throw new CbError(Errors.unsupportedDirectDebitScheme);
      }
    }

    return out;
  }

  private validateSepa(bankAccount: BankAccount): boolean {
    // Basic IBAN validation (can be enhanced)
    const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/;
    return ibanRegex.test(bankAccount.iban.replace(/\s/g, ''));
  }

  private validateAch(bankAccount: BankAccount): boolean {
    // Basic routing number validation (can be enhanced)
    const routingNumberRegex = /^\d{8,9}$/;
    const accountNumberRegex = /^\d{1,17}$/;
    return routingNumberRegex.test(bankAccount.routingNumber) && accountNumberRegex.test(bankAccount.accountNumber);
  }

  static get(intent: PaymentIntent): DirectDebitDataManager {
    return new DirectDebitDataManager(intent.gateway, intent.currency_code);
  }
}
