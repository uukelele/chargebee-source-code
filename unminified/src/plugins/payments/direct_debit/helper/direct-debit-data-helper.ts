import {PaymentInfo, GatewayPaymentInfo} from '../types';
import {Gateway, PaymentIntent, PaymentMethodType} from '@/internal/payment-intent/types';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {getBeneficiaryName} from '@/utils/utility-functions';

/**
 * @deprecated Use DataManager instead of DataHelper
 */
export class DirectDebitDataHelper {
  private paymentIntent: PaymentIntent;

  constructor(paymentIntent: PaymentIntent) {
    this.paymentIntent = paymentIntent;
  }

  validatePaymentInfo(paymentInfo: PaymentInfo | GatewayPaymentInfo): boolean {
    switch (this.paymentIntent.currency_code) {
      case 'EUR':
        return this.validateSepaPaymentInfo(paymentInfo);
      case 'USD':
        return this.validateAchPaymentInfo(paymentInfo);
      default:
        throw new CbError(Errors.unsupportedDirectDebitScheme);
    }
  }

  transformPaymentInfo(paymentInfo: PaymentInfo | GatewayPaymentInfo): object {
    switch (this.paymentIntent.currency_code) {
      case 'EUR':
        return this.transformSepaPaymentInfo(paymentInfo);
      case 'USD':
        return this.transformAchPaymentInfo(paymentInfo);
      default:
        throw new CbError(Errors.unsupportedDirectDebitScheme);
    }
  }

  /**
   *  Data Validator
   */

  private validateSepaPaymentInfo(paymentInfo: PaymentInfo): boolean {
    switch (this.paymentIntent.gateway) {
      case Gateway.ADYEN:
      case Gateway.STRIPE:
        return this.validateCommonSepaPaymentInfo(paymentInfo);
      case Gateway.MOLLIE:
        return this.validateMollieSepaPaymentInfo(paymentInfo);

      default:
        throw new CbError(Errors.unsupportedDirectDebitGateway);
    }
  }

  private validateAchPaymentInfo(paymentInfo: PaymentInfo | GatewayPaymentInfo): boolean {
    switch (this.paymentIntent.gateway) {
      case Gateway.CHECKOUT_COM:
        return this.validatePlaidAchPaymentInfo(paymentInfo);
      case Gateway.STRIPE:
        return this.stripeAchPaymentInfo(paymentInfo);
      case Gateway.CHARGEBEE_PAYMENTS:
        return this.validateChargebeePaymentAchPaymentInfo(paymentInfo);
      case Gateway.ADYEN:
        return this.validateAdyenAchPaymentInfo(paymentInfo);
      case Gateway.AUTHORIZE_NET:
        return this.validateAuthNetAchPaymentInfo(paymentInfo);
      case Gateway.CYBERSOURCE:
        return this.validateCybersourceAchPaymentInfo(paymentInfo);

      default:
        throw new CbError(Errors.unsupportedDirectDebitGateway);
    }
  }

  private validateCommonSepaPaymentInfo(paymentInfo: PaymentInfo): boolean {
    return !!(
      paymentInfo.customer &&
      (paymentInfo.customer.firstName || paymentInfo.customer.lastName || paymentInfo.customer.company) &&
      paymentInfo.customer.email &&
      paymentInfo.bankAccount &&
      paymentInfo.bankAccount.iban
    );
  }

  private validateMollieSepaPaymentInfo(paymentInfo: PaymentInfo): boolean {
    return !!(
      this.paymentIntent.reference_id ||
      (paymentInfo.customer &&
        (paymentInfo.customer.firstName || paymentInfo.customer.lastName) &&
        paymentInfo.bankAccount &&
        paymentInfo.bankAccount.iban)
    );
  }

  private validateChargebeePaymentAchPaymentInfo(paymentInfo: PaymentInfo): boolean {
    return !!(
      this.paymentIntent.reference_id ||
      (paymentInfo.bankAccount &&
        paymentInfo.bankAccount.routingNumber &&
        paymentInfo.bankAccount.accountNumber &&
        paymentInfo.bankAccount.accountType &&
        (paymentInfo.bankAccount.nameOnAccount ||
          paymentInfo.customer ||
          paymentInfo.customer.firstName ||
          paymentInfo.customer.lastName))
    );
  }
  private validateAdyenAchPaymentInfo(paymentInfo: PaymentInfo): boolean {
    return !!(
      this.paymentIntent.reference_id ||
      (paymentInfo.bankAccount &&
        paymentInfo.bankAccount.routingNumber &&
        paymentInfo.bankAccount.accountNumber &&
        paymentInfo.bankAccount.accountType)
    );
  }

  private validateAuthNetAchPaymentInfo(paymentInfo: PaymentInfo): boolean {
    return !!(
      this.paymentIntent.reference_id ||
      (paymentInfo.bankAccount &&
        paymentInfo.bankAccount.routingNumber &&
        paymentInfo.bankAccount.accountNumber &&
        paymentInfo.bankAccount.accountType &&
        paymentInfo.bankAccount.bankName &&
        paymentInfo.customer &&
        (paymentInfo.customer.firstName || paymentInfo.customer.lastName))
    );
  }

  private validateCybersourceAchPaymentInfo(paymentInfo: PaymentInfo): boolean {
    return !!(
      this.paymentIntent.reference_id ||
      (paymentInfo.customer &&
        (paymentInfo.customer.firstName || paymentInfo.customer.lastName) &&
        paymentInfo.customer.email &&
        paymentInfo.bankAccount &&
        paymentInfo.bankAccount.routingNumber &&
        paymentInfo.bankAccount.accountNumber &&
        paymentInfo.bankAccount.accountType)
    );
  }

  private stripeAchPaymentInfo(paymentInfo: GatewayPaymentInfo): boolean {
    if (paymentInfo.payload && paymentInfo.payload.plaid) {
      return this.validatePlaidAchPaymentInfo(paymentInfo);
    } else {
      return this.validateFCAchPaymentInfo(paymentInfo);
    }
  }

  private validatePlaidAchPaymentInfo(paymentInfo: GatewayPaymentInfo): boolean {
    return !!(
      paymentInfo.payload &&
      paymentInfo.payload.publicToken &&
      paymentInfo.payload.accountId &&
      paymentInfo.payload.locale
    );
  }

  private validateFCAchPaymentInfo(paymentInfo: GatewayPaymentInfo): boolean {
    return !!(paymentInfo.customer && (paymentInfo.customer.firstName || paymentInfo.customer.lastName));
  }

  /**
   *  Data Transformer
   */

  private transformSepaPaymentInfo(paymentInfo: PaymentInfo): object {
    switch (this.paymentIntent.gateway) {
      case Gateway.ADYEN:
      case Gateway.STRIPE:
        return this.transformCommonSepaPaymentInfo(paymentInfo);
      case Gateway.MOLLIE:
        return this.transformMollieSepaPaymentInfo(paymentInfo);
      default:
        throw new CbError(Errors.unsupportedDirectDebitGateway);
    }
  }

  private transformAchPaymentInfo(paymentInfo: PaymentInfo | GatewayPaymentInfo): object {
    switch (this.paymentIntent.gateway) {
      case Gateway.CHECKOUT_COM:
        return this.transformPlaidAchPaymentInfo(paymentInfo);
      case Gateway.STRIPE:
        return this.transformStripeAchPaymentInfo(paymentInfo);
      case Gateway.CHARGEBEE_PAYMENTS:
        return this.transformChargebeePaymentsAchPaymentInfo(paymentInfo);
      case Gateway.ADYEN:
        return this.transformAdyenAchPaymentInfo(paymentInfo);
      case Gateway.AUTHORIZE_NET:
        return this.transformAuthNetAchPaymentInfo(paymentInfo);
      case Gateway.CYBERSOURCE:
        return this.transformCybersourceAchPaymentInfo(paymentInfo);
      default:
        throw new CbError(Errors.unsupportedDirectDebitGateway);
    }
  }

  private transformCommonSepaPaymentInfo(paymentInfo: PaymentInfo): object {
    return {
      paymentMethodType: PaymentMethodType.DIRECT_DEBIT,
      params: {
        ownerName:
          `${paymentInfo.customer.company || ''}`.trim() ||
          `${paymentInfo.customer.firstName || ''} ${paymentInfo.customer.lastName || ''}`.trim(),
        ownerEmail: paymentInfo.customer.email,
      },
      directDebitBankAccount: {
        iban: paymentInfo.bankAccount.iban,
      },
      customerBillingAddress: paymentInfo.customer.billingAddress,
      customer: {
        firstName: paymentInfo.customer.firstName,
        lastName: paymentInfo.customer.lastName,
        email: paymentInfo.customer.email,
        companyName: paymentInfo.customer.company,
      },
    };
  }
  private transformMollieSepaPaymentInfo(paymentInfo: PaymentInfo): object {
    let params = {
      paymentMethodType: PaymentMethodType.DIRECT_DEBIT,
    };
    if (!this.paymentIntent.reference_id) {
      params['directDebitBankAccount'] = {
        beneficiaryName: `${paymentInfo.customer.firstName || ''} ${paymentInfo.customer.lastName || ''}`.trim(),
        iban: paymentInfo.bankAccount.iban,
      };
    }
    return params;
  }

  private transformStripeAchPaymentInfo(paymentInfo: PaymentInfo | GatewayPaymentInfo): object {
    switch (this.paymentIntent.gateway) {
      case Gateway.STRIPE:
        return this.transformFCAchPaymentInfo(paymentInfo);
      default:
        return this.transformPlaidAchPaymentInfo(paymentInfo);
    }
  }

  private transformPlaidAchPaymentInfo(paymentInfo: GatewayPaymentInfo): object {
    return {
      paymentMethodType: PaymentMethodType.DIRECT_DEBIT,
      plaidConfiguration: {
        locale: paymentInfo.payload.locale,
        publicToken: paymentInfo.payload.publicToken,
        accountId: paymentInfo.payload.accountId,
      },
    };
  }

  private transformFCAchPaymentInfo(input: GatewayPaymentInfo): object {
    let out: any;
    if (input.payload && input.payload.plaid) {
      out = this.transformPlaidAchPaymentInfo(input);
    } else {
      out = {
        paymentMethodType: PaymentMethodType.DIRECT_DEBIT,
        achVerificationType: input.achVerificationType,
      };
    }
    if (input.customer) {
      out['paymentMethodDetails'] = {
        firstName: input.customer.firstName,
        lastName: input.customer.lastName,
        companyName: input.customer.company,
        email: input.customer.email,
        phone: input.customer.phone,
        billingAddress: input.customer.billingAddress,
      };
    }
    return out;
  }

  private transformChargebeePaymentsAchPaymentInfo(paymentInfo: GatewayPaymentInfo): object {
    let params = {
      paymentMethodType: PaymentMethodType.DIRECT_DEBIT,
    };
    if (!this.paymentIntent.reference_id) {
      params['directDebitBankAccount'] = {
        beneficiaryName: getBeneficiaryName(paymentInfo),
        routingNumber: paymentInfo.bankAccount.routingNumber,
        accountNumber: paymentInfo.bankAccount.accountNumber,
        accountType: paymentInfo.bankAccount.accountType,
      };
    }
    if (paymentInfo.customer) {
      params['customer'] = {
        firstName: paymentInfo.customer.firstName,
        lastName: paymentInfo.customer.lastName,
        email: paymentInfo.customer.email,
        phone: paymentInfo.customer.phone,
        billingAddress: paymentInfo.customer.billingAddress,
      };
    }
    return params;
  }

  private transformAdyenAchPaymentInfo(paymentInfo: GatewayPaymentInfo): object {
    let params = {
      paymentMethodType: PaymentMethodType.DIRECT_DEBIT,
    };
    if (paymentInfo.customer) {
      params['paymentMethodDetails'] = {
        firstName: paymentInfo.customer.firstName,
        lastName: paymentInfo.customer.lastName,
        billingAddress: paymentInfo.customer.billingAddress,
      };
    }
    if (!this.paymentIntent.reference_id) {
      params['paymentMethodDetails'] = {
        ...params['paymentMethodDetails'],
        directDebitBankAccount: {
          accountNumber: paymentInfo.bankAccount.accountNumber,
          routingNumber: paymentInfo.bankAccount.routingNumber,
          accountType: paymentInfo.bankAccount.accountType,
        },
      };
    }
    return params;
  }

  private transformAuthNetAchPaymentInfo(paymentInfo: GatewayPaymentInfo): object {
    let params = {
      paymentMethodType: PaymentMethodType.DIRECT_DEBIT,
    };

    if (!this.paymentIntent.reference_id) {
      params['paymentMethodDetails'] = {
        directDebitBankAccount: {
          accountNumber: paymentInfo.bankAccount.accountNumber,
          routingNumber: paymentInfo.bankAccount.routingNumber,
          accountType: paymentInfo.bankAccount.accountType,
          bankName: paymentInfo.bankAccount.bankName,
        },
        firstName: paymentInfo.customer.firstName,
        lastName: paymentInfo.customer.lastName,
      };
    }
    return params;
  }

  private transformCybersourceAchPaymentInfo(paymentInfo: GatewayPaymentInfo): object {
    let params = {
      paymentMethodType: PaymentMethodType.DIRECT_DEBIT,
    };
    if (paymentInfo.customer) {
      params['paymentMethodDetails'] = {
        firstName: paymentInfo.customer.firstName,
        lastName: paymentInfo.customer.lastName,
        email: paymentInfo.customer.email,
        billingAddress: paymentInfo.customer.billingAddress,
      };
    }
    if (!this.paymentIntent.reference_id) {
      params['paymentMethodDetails'] = {
        ...params['paymentMethodDetails'],
        directDebitBankAccount: {
          accountNumber: paymentInfo.bankAccount.accountNumber,
          routingNumber: paymentInfo.bankAccount.routingNumber,
          accountType: paymentInfo.bankAccount.accountType,
        },
      };
    }
    return params;
  }
}
