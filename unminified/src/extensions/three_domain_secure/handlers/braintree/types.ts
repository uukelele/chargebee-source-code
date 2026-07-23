export namespace Braintree {
  export type BillingAddress = {
    givenName?: string;
    surname?: string;
    phoneNumber?: string;
    streetAddress?: string;
    extendedAddress?: string;
    line3?: string;
    locality?: string;
    region?: string;
    postalCode?: string;
    countryCodeAlpha2?: string;
  };

  export type ShippingAddress = {
    streetAddress?: string;
    extendedAddress?: string;
    line3: string;
    locality?: string;
    region?: string;
    postalCode?: string;
    countryCodeAlpha2?: string;
  };

  export type ThreeDSParams = {
    amount: string;
    nonce?: string;
    challengeRequested?: boolean;
    bin?: string; // Bank Identification Number
    email?: string;
    mobilePhoneNumber?: string;
    billingAddress?: Braintree.BillingAddress;
    collectDeviceData: boolean;
    additionalInformation?: {
      workPhoneNumber?: string;
      shippingGivenName?: string;
      shippingSurname?: string;
      shippingPhone?: string;
      shippingAddress?: Braintree.ShippingAddress;
      acsWindowSize?: string;
      ipAddress: string;
    };

    // Callbacks
    onLookupComplete?: Function;

    // Parameters for 3DS V1
    addFrame?: Function;
    removeFrame?: Function;
  };

  export type LookupParams = {
    lookup: {
      acsUrl: string;
      md: string;
      pareq: string;
      termUrl: string;
      threeDSecureVersion: string;
      transactionId: string;
    };

    paymentMethod: Braintree.TokenizedCard &
      Braintree.LiabilityShift & {
        status: string;
        enrolled: string; // Y/N
      };

    threeDSecureInfo: Braintree.LiabilityShift;
    type: string;
  };

  export type LiabilityShift = {
    liabilityShiftPossible?: boolean;
    liabilityShifted?: boolean;
  };

  export type BraintreeCardDetails = {
    bin: string;
    lastTwo: string;
    lastFour: string;
    cardType: string;
  };

  export type VerifyResponse = {
    description?: string;
    details?: BraintreeCardDetails;
    nonce?: string;
    authenticationInsight?: {
      regulationEnvironment: REGULATION_ENVIRONMENT;
    };
  } & Braintree.LiabilityShift;

  export type TokenizedCard = {
    type?: string;
    binData?: {
      commercial: string;
      countryOfIssuance: string;
      debit: string;
      durbinRegulated: string;
      healthcare: string;
      issuingBank: string;
      payroll: string;
      prepaid: string;
      productId: string;
    };
  } & Braintree.VerifyResponse;

  export type TokenizerResponse = {
    _httpStatus: number;
    creditCards: Array<TokenizedCard>;
  };

  export type ClientTokenResponse = {
    client_token: string;
    payment_method_nonce?: string;
    payment_method_challenge_requested?: boolean;
    merchant_account_id?: string;
    auth_insight_regulation_env?: REGULATION_ENVIRONMENT;
    details?: BraintreeCardDetails;
    origin_ip_address?: string;
    three_ds_enabled?: boolean;
  };

  export type CardBillingAddress = {
    company?: string;
    countryCodeAlpha2?: string;
    countryCodeAlpha3?: string;
    countryCodeNumeric?: string;
    countryName?: string;
    extendedAddress?: string;
    firstName?: string;
    lastName?: string;
    locality?: string;
    postalCode?: string;
    region?: string;
    streetAddress?: string;
  };

  export type CreditCard = {
    cardholderName?: string;
    number: string;
    cvv: string;
    expirationDate: string;
    billingAddress?: Braintree.CardBillingAddress;
    options?: {validate?: boolean};
  };

  export type CardDetails = {
    creditCard: CreditCard;
  };

  export type TokenizationAdditionalInfo = {
    bin?: string;
    regulationEnvironment?: REGULATION_ENVIRONMENT;
  };

  export type DeviceData = {
    correlation_id?: string | null;
    device_session_id?: string | null;
    fraud_merchant_id?: string | null;
  };

  export type FraudData = {
    fraud?: DeviceData;
  };

  // https://developer.paypal.com/braintree/docs/guides/3d-secure/migration/javascript/v3#regulation-environment-psd2
  export enum REGULATION_ENVIRONMENT {
    PSD2 = 'psd2',
    UNREGULATED = 'unregulated',
    UNAVAILABLE = 'unavailable',
  }

  export type RetrievePaymentMethodNonceResponse = {
    merchant_account_id: string;
    payment_method_nonce: string;
    details?: Braintree.BraintreeCardDetails;
    auth_insight_regulation_env?: Braintree.REGULATION_ENVIRONMENT;
  };

  export type ClientError = {
    code: string;
    message: string;
    name: string;
    type: string;
    error?: {
      message: string;
    };
    threeDSecureInfo?: {
      liabilityShifted: boolean;
      liabilityShiftPossible: boolean;
    };
    details?: {
      // error format from braintree
      originalError?: {
        details?: {
          originalError?: {
            error?: {
              message: string;
            };
          };
        };
        error?: {
          message: string;
        };
        // field specific errors
        fieldErrors?: Array<{
          field?: string;
          fieldErrors?: Array<{
            code?: string;
            field?: string;
            message?: string;
          }>;
        }>;
        message?: string;
      };
    };
  };
}
