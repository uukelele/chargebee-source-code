import {Gateway} from '@/internal/payment-intent/types';

const TYPE_1 = ['accountNumber'];

const TYPE_2 = ['accountNumber', 'bankCode'];

const TYPE_3 = ['accountNumber', 'routingNumber'];

const TYPE_4 = ['accountNumber', 'routingNumber', 'bankCode'];

const TYPE_5 = ['accountNumber', 'routingNumber', 'bankCode', 'suffix'];

const TYPE_6 = ['accountNumber', 'bankCode', 'accountType'];

const TYPE_7 = ['accountNumber', 'routingNumber', 'swedishIdentityNumber'];

const TYPE_8 = ['accountNumber', 'routingNumber', 'accountType'];

const TYPE_9 = ['accountNumber', 'routingNumber', 'accountType', 'accountHolderType'];

const TYPE_10 = ['accountNumber', 'routingNumber', 'accountType', 'bankName'];

const TYPE_11 = ['iban'];

const TYPE_12 = ['accountNumber', 'branchCode', 'bankCode', 'suffix'];

const CONFIG = {
  braintree_ach: [
    {
      display_name: 'United States',
      country_code: 'US',
      bank_fields: TYPE_9,
    },
  ],

  bluesnap_ach: [
    {
      display_name: 'United States',
      country_code: 'US',
      bank_fields: TYPE_8,
    },
  ],

  adyen_ach: [
    {
      display_name: 'United States',
      country_code: 'US',
      bank_fields: TYPE_8,
    },
  ],

  cybersource_ach: [
    {
      display_name: 'United States',
      country_code: 'US',
      bank_fields: TYPE_8,
    },
  ],

  gocardless_stripe_adyen_chargebee_payments_bacs: [
    {
      display_name: 'United Kingdom',
      country_code: 'GB',
      bank_fields: TYPE_3,
    },
  ],

  gocardless_autogiro: [
    {
      display_name: 'Sweden',
      country_code: 'SE',
      bank_fields: TYPE_7,
    },
  ],

  gocardless_ach: [
    {
      display_name: 'United States',
      country_code: 'US',
      bank_fields: TYPE_6,
    },
  ],

  gocardless_stripe_becs: [
    {
      display_name: 'Australia',
      country_code: 'AU',
      bank_fields: TYPE_3,
    },
  ],

  ezidebit_becs: [
    {
      display_name: 'Australia',
      country_code: 'AU',
      bank_fields: TYPE_2,
    },
  ],

  gocardless_pad: [
    {
      display_name: 'Canada',
      country_code: 'CA',
      bank_fields: TYPE_4,
    },
  ],

  gocardless_becs_nz: [
    {
      display_name: 'New Zealand',
      country_code: 'NZ',
      bank_fields: TYPE_5,
    },
  ],

  ezidebit_becs_nz: [
    {
      display_name: 'New Zealand',
      country_code: 'NZ',
      bank_fields: TYPE_2,
    },
  ],

  stripe_becs_nz: [
    {
      display_name: 'New Zealand',
      country_code: 'NZ',
      bank_fields: TYPE_12,
    },
  ],

  gocardless_sepa: [
    {
      display_name: 'Austria',
      country_code: 'AT',
      bank_fields: TYPE_2,
    },
    {
      display_name: 'Belgium',
      country_code: 'BE',
      bank_fields: TYPE_1,
    },
    {
      display_name: 'Cyprus',
      country_code: 'CY',
      bank_fields: TYPE_4,
    },
    {
      display_name: 'Estonia',
      country_code: 'EE',
      bank_fields: TYPE_1,
    },
    {
      display_name: 'Finland',
      country_code: 'FI',
      bank_fields: TYPE_2,
    },
    {
      display_name: 'Aland Islands',
      country_code: 'AX',
      bank_fields: TYPE_2,
    },
    {
      display_name: 'France',
      country_code: 'FR',
      bank_fields: TYPE_4,
    },
    {
      display_name: 'French Guiana',
      country_code: 'GF',
      bank_fields: TYPE_4,
    },
    {
      display_name: 'Guadeloupe',
      country_code: 'GP',
      bank_fields: TYPE_4,
    },
    {
      display_name: 'Mayotte',
      country_code: 'YT',
      bank_fields: TYPE_4,
    },
    {
      display_name: 'Reunion',
      country_code: 'RE',
      bank_fields: TYPE_4,
    },
    {
      display_name: 'Saint Barthélemy',
      country_code: 'BL',
      bank_fields: TYPE_4,
    },
    {
      display_name: 'Saint Martin',
      country_code: 'MF',
      bank_fields: TYPE_4,
    },
    {
      display_name: 'Saint Pierre and Miquelon',
      country_code: 'PM',
      bank_fields: TYPE_4,
    },
    {
      display_name: 'Germany',
      country_code: 'DE',
      bank_fields: TYPE_2,
    },
    {
      display_name: 'Greece',
      country_code: 'GR',
      bank_fields: TYPE_4,
    },
    {
      display_name: 'Ireland',
      country_code: 'IE',
      bank_fields: TYPE_3,
    },
    {
      display_name: 'Italy',
      country_code: 'IT',
      bank_fields: TYPE_4,
    },
    {
      display_name: 'Latvia',
      country_code: 'LV',
      bank_fields: TYPE_2,
    },
    {
      display_name: 'Lithuania',
      country_code: 'LT',
      bank_fields: TYPE_2,
    },
    {
      display_name: 'Luxembourg',
      country_code: 'LU',
      bank_fields: TYPE_2,
    },
    {
      display_name: 'Malta',
      country_code: 'MT',
      bank_fields: TYPE_3,
    },
    {
      display_name: 'Monaco',
      country_code: 'MC',
      bank_fields: TYPE_4,
    },
    {
      display_name: 'Netherlands',
      country_code: 'NL',
      bank_fields: TYPE_2,
    },
    {
      display_name: 'Portugal',
      country_code: 'PT',
      bank_fields: TYPE_4,
    },
    {
      display_name: 'San Marino',
      country_code: 'SM',
      bank_fields: TYPE_4,
    },
    {
      display_name: 'Slovakia',
      country_code: 'SK',
      bank_fields: TYPE_2,
    },
    {
      display_name: 'Slovenia',
      country_code: 'SI',
      bank_fields: TYPE_2,
    },
    {
      display_name: 'Spain',
      country_code: 'ES',
      bank_fields: TYPE_4,
    },
  ],
  authorize_net_ach: [
    {
      display_name: 'United States',
      country_code: 'US',
      bank_fields: TYPE_10,
    },
  ],

  mollie_sepa: [
    {
      display_name: 'Austria',
      country_code: 'AT',
      bank_fields: TYPE_11,
    },
    {
      display_name: 'Belgium',
      country_code: 'BE',
      bank_fields: TYPE_11,
    },
    {
      display_name: 'Cyprus',
      country_code: 'CY',
      bank_fields: TYPE_11,
    },
    {
      display_name: 'Estonia',
      country_code: 'EE',
      bank_fields: TYPE_11,
    },
    {
      display_name: 'Finland',
      country_code: 'FI',
      bank_fields: TYPE_11,
    },
    {
      display_name: 'France',
      country_code: 'FR',
      bank_fields: TYPE_11,
    },
    {
      display_name: 'Germany',
      country_code: 'DE',
      bank_fields: TYPE_11,
    },
    {
      display_name: 'Greece',
      country_code: 'GR',
      bank_fields: TYPE_11,
    },
    {
      display_name: 'Ireland',
      country_code: 'IE',
      bank_fields: TYPE_11,
    },
    {
      display_name: 'Italy',
      country_code: 'IT',
      bank_fields: TYPE_11,
    },
    {
      display_name: 'Latvia',
      country_code: 'LV',
      bank_fields: TYPE_11,
    },
    {
      display_name: 'Lithuania',
      country_code: 'LT',
      bank_fields: TYPE_11,
    },
    {
      display_name: 'Luxembourg',
      country_code: 'LU',
      bank_fields: TYPE_11,
    },
    {
      display_name: 'Malta',
      country_code: 'MT',
      bank_fields: TYPE_11,
    },
    {
      display_name: 'Monaco',
      country_code: 'MC',
      bank_fields: TYPE_11,
    },
    {
      display_name: 'Netherlands',
      country_code: 'NL',
      bank_fields: TYPE_11,
    },
    {
      display_name: 'Portugal',
      country_code: 'PT',
      bank_fields: TYPE_11,
    },
    {
      display_name: 'San Marino',
      country_code: 'SM',
      bank_fields: TYPE_11,
    },
    {
      display_name: 'Slovakia',
      country_code: 'SK',
      bank_fields: TYPE_11,
    },
    {
      display_name: 'Slovenia',
      country_code: 'SI',
      bank_fields: TYPE_11,
    },
    {
      display_name: 'Spain',
      country_code: 'ES',
      bank_fields: TYPE_11,
    },
    {
      display_name: 'Bulgaria',
      country_code: 'BG',
      bank_fields: TYPE_11,
    },
    {
      display_name: 'Croatia',
      country_code: 'HR',
      bank_fields: TYPE_11,
    },
    {
      display_name: 'Czech Republic',
      country_code: 'CZ',
      bank_fields: TYPE_11,
    },
    {
      display_name: 'Denmark',
      country_code: 'DK',
      bank_fields: TYPE_11,
    },
    {
      display_name: 'Hungary',
      country_code: 'HU',
      bank_fields: TYPE_11,
    },
    {
      display_name: 'Poland',
      country_code: 'PL',
      bank_fields: TYPE_11,
    },
    {
      display_name: 'Romania',
      country_code: 'RO',
      bank_fields: TYPE_11,
    },
    {
      display_name: 'Sweden',
      country_code: 'SE',
      bank_fields: TYPE_11,
    },
    {
      display_name: 'Iceland',
      country_code: 'IS',
      bank_fields: TYPE_11,
    },
    {
      display_name: 'Liechtenstein',
      country_code: 'LI',
      bank_fields: TYPE_11,
    },
    {
      display_name: 'Norway',
      country_code: 'NO',
      bank_fields: TYPE_11,
    },
    {
      display_name: 'Andorra',
      country_code: 'AD',
      bank_fields: TYPE_11,
    },
    {
      display_name: 'Vatican City',
      country_code: 'VA',
      bank_fields: TYPE_11,
    },
  ],
};

export default class BankFieldHelper {
  private static isCountrySupported(config: any[], country_code: string): boolean {
    country_code = (country_code || '').toUpperCase();
    return config.filter((i) => i.country_code == country_code).length > 0;
  }

  private static getFields(config: any[], country_code: string): string[] {
    country_code = (country_code || '').toUpperCase();
    let obj: any = config.filter((i) => i.country_code == country_code);
    return (obj && obj[0] && obj[0].bank_fields) || [];
  }

  static isCountryForAch(gateway: Gateway, country_code: string): boolean {
    switch (gateway) {
      case Gateway.GOCARDLESS:
        return this.isCountrySupported(CONFIG.gocardless_ach, country_code);
      case Gateway.BLUESNAP:
        return this.isCountrySupported(CONFIG.bluesnap_ach, country_code);
      case Gateway.BRAINTREE:
        return this.isCountrySupported(CONFIG.braintree_ach, country_code);
      case Gateway.ADYEN:
        return this.isCountrySupported(CONFIG.adyen_ach, country_code);
      case Gateway.AUTHORIZE_NET:
        return this.isCountrySupported(CONFIG.authorize_net_ach, country_code);
      case Gateway.CYBERSOURCE:
        return this.isCountrySupported(CONFIG.cybersource_ach, country_code);
      default:
        return false;
    }
  }

  static isCountryForAutogiro(gateway: Gateway, country_code: string): boolean {
    switch (gateway) {
      case Gateway.GOCARDLESS:
        return this.isCountrySupported(CONFIG.gocardless_autogiro, country_code);
      default:
        return false;
    }
  }

  static isCountryForBacs(gateway: Gateway, country_code: string): boolean {
    switch (gateway) {
      case Gateway.GOCARDLESS:
      case Gateway.STRIPE:
      case Gateway.ADYEN:
      case Gateway.CHARGEBEE_PAYMENTS:
        return this.isCountrySupported(CONFIG.gocardless_stripe_adyen_chargebee_payments_bacs, country_code);
      default:
        return false;
    }
  }

  static isCountryForBecs(gateway: Gateway, country_code: string): boolean {
    switch (gateway) {
      case Gateway.GOCARDLESS:
      case Gateway.STRIPE:
        return this.isCountrySupported(CONFIG.gocardless_stripe_becs, country_code);
      case Gateway.EZIDEBIT:
        return this.isCountrySupported(CONFIG.ezidebit_becs, country_code);
      default:
        return false;
    }
  }

  static isCountryForBecsNZ(gateway: Gateway, country_code: string): boolean {
    switch (gateway) {
      case Gateway.GOCARDLESS:
        return this.isCountrySupported(CONFIG.gocardless_becs_nz, country_code);
      case Gateway.EZIDEBIT:
        return this.isCountrySupported(CONFIG.ezidebit_becs_nz, country_code);
      case Gateway.STRIPE:
        return this.isCountrySupported(CONFIG.stripe_becs_nz, country_code);
      default:
        return false;
    }
  }

  static isCountryForPad(gateway: Gateway, country_code: string): boolean {
    switch (gateway) {
      case Gateway.GOCARDLESS:
        return this.isCountrySupported(CONFIG.gocardless_pad, country_code);
      default:
        return false;
    }
  }

  static isCountryForSepa(gateway: Gateway, country_code: string): boolean {
    switch (gateway) {
      case Gateway.GOCARDLESS:
        return this.isCountrySupported(CONFIG.gocardless_sepa, country_code);
      case Gateway.MOLLIE:
        return this.isCountrySupported(CONFIG.mollie_sepa, country_code);
      default:
        return false;
    }
  }

  static getAchFields(gateway: Gateway, country_code: string): string[] {
    switch (gateway) {
      case Gateway.GOCARDLESS:
        return this.getFields(CONFIG.gocardless_ach, country_code);
      case Gateway.BLUESNAP:
        return this.getFields(CONFIG.bluesnap_ach, country_code);
      case Gateway.BRAINTREE:
        return this.getFields(CONFIG.braintree_ach, country_code);
      case Gateway.ADYEN:
        return this.getFields(CONFIG.adyen_ach, country_code);
      case Gateway.AUTHORIZE_NET:
        return this.getFields(CONFIG.authorize_net_ach, country_code);
      case Gateway.CYBERSOURCE:
        return this.getFields(CONFIG.cybersource_ach, country_code);
      default:
        return [];
    }
  }

  static getAutogiroFields(gateway: Gateway, country_code: string): string[] {
    switch (gateway) {
      case Gateway.GOCARDLESS:
        return this.getFields(CONFIG.gocardless_autogiro, country_code);
      default:
        return [];
    }
  }

  static getBacsFields(gateway: Gateway, country_code: string): string[] {
    switch (gateway) {
      case Gateway.GOCARDLESS:
      case Gateway.STRIPE:
      case Gateway.ADYEN:
      case Gateway.CHARGEBEE_PAYMENTS:
        return this.getFields(CONFIG.gocardless_stripe_adyen_chargebee_payments_bacs, country_code);
      default:
        return [];
    }
  }

  static getBecsFields(gateway: Gateway, country_code: string): string[] {
    switch (gateway) {
      case Gateway.GOCARDLESS:
      case Gateway.STRIPE:
        return this.getFields(CONFIG.gocardless_stripe_becs, country_code);
      case Gateway.EZIDEBIT:
        return this.getFields(CONFIG.ezidebit_becs, country_code);
      default:
        return [];
    }
  }

  static getBecsFieldsNZ(gateway: Gateway, country_code: string): string[] {
    switch (gateway) {
      case Gateway.GOCARDLESS:
        return this.getFields(CONFIG.gocardless_becs_nz, country_code);
      case Gateway.EZIDEBIT:
        return this.getFields(CONFIG.ezidebit_becs_nz, country_code);
      case Gateway.STRIPE:
        return this.getFields(CONFIG.stripe_becs_nz, country_code);
      default:
        return [];
    }
  }

  static getPadFields(gateway: Gateway, country_code: string): string[] {
    switch (gateway) {
      case Gateway.GOCARDLESS:
        return this.getFields(CONFIG.gocardless_pad, country_code);
      default:
        return [];
    }
  }

  static getSepaFields(gateway: Gateway, country_code: string): string[] {
    switch (gateway) {
      case Gateway.GOCARDLESS:
        return this.getFields(CONFIG.gocardless_sepa, country_code);
      case Gateway.MOLLIE:
        return this.getFields(CONFIG.mollie_sepa, country_code);
      default:
        return [];
    }
  }
}
