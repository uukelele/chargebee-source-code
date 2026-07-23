export interface StripeInstance {
  [key: string]: any;
}

export interface StripeGatewayCredential {
  publishable_key: string;
  apple_pay?: {
    merchant_country_code?: string;
    stripe_account_id?: string;
    stripePaymentConfig?: string;
  };
}

export interface CommonGatewayCredential {
  apple_pay: {
    merchant_country_code: string;
    copy_billing_address: boolean;
    copy_shipping_address: boolean;
    copy_contact: boolean;
  };
}

export interface StripePaymentRequest extends PaymentRequest {
  total: ApplePayLineItem;
  update: (options: StripeUpdatePaymentRequestOptions) => void;
  on: (eventName: string, callback: (event: StripePaymentEvent) => any) => any;
  canMakePayment: () => Promise<boolean>;
  show: () => void;
}

export interface StripeShippingAddress {
  country: string;
  addressLine?: Array<string>;
  region?: string;
  city?: string;
  postalCode?: string;
  recipient?: string;
  phone?: string;
  sortingCode?: string;
  dependentLocality?: string;
}

export interface StripeAddress {
  country: string;
  line1?: string;
  line2?: string;
  city?: string;
  postal_code?: string;
  state?: string;
}

export interface StripeAddressDetails {
  email?: string;
  name?: string;
  phone?: string;
  address: StripeAddress;
}

export interface StripePaymentEvent {
  paymentMethod?: StripePaymentMethod;
  complete?: (status: string) => void;
  payerName?: string;
  payerEmail?: string;
  walletName?: string;
  shippingAddress?: StripeShippingAddress | StripeAddressDetails;
  shippingOption?: StripeShippingOption;
  updateWith?: (updateDetails) => void;
}

interface StripeCardDetails {
  last4: string;
}

export interface StripeElementsInstance {
  create: (type: string, payload: any) => any;
}

export interface StripePaymentRequestButton {
  mount: (querySelector: string) => void;
}

export interface StripePaymentMethod {
  id: string;
  card: StripeCardDetails;
  billing_details?: StripeAddressDetails;
}

export interface StripePaymentRequestOptions {
  requestPayerName?: boolean;
  requestPayerEmail?: boolean;
  requestPayerPhone?: boolean;
  requestShipping?: boolean;
  requestBilling?: boolean;
  totalLabel?: string;
  displayItems?: Array<ApplePayLineItem>;
  shippingOptions?: Array<StripeShippingOption>;
  merchantCountryCode?: string;
  recurringPaymentRequest?: ApplePayRecurringPaymentRequest;
  onshippingmethodselected?: (event, callback) => void;
  onshippingcontactselected?: (event, callback) => void;
  onpaymentmethodselected?: (event, callback) => void;
}

export interface StripeMountOptions {
  locale?: string;
  buttonColor?: string;
  buttonType?: string;
}

export interface StripeError {
  type?: string;
  code?: string;
  message?: string;
}

export interface StripePaymentIntent {
  id: string;
  amount: number;
  client_secret: string;
  livemode: boolean;
  status: string;
}

export interface StripeConfirmResult {
  error?: StripeError;
  paymentIntent?: StripePaymentIntent;
}

export enum PaymentCompleteStatus {
  FAIL = 'fail',
  SUCCESS = 'success',
}

export enum StripeDeliveryEstimateUnit {
  BUSINESS_DAY = 'business_day',
  MONTH = 'month',
  DAY = 'day',
  HOUR = 'hour',
  WEEK = 'week',
}

export interface StripeDeliveryEstimatePaymentOptions {
  unit?: StripeDeliveryEstimateUnit;
  value?: number;
}

export interface StripeDeliveryEstimateOptions {
  maximum?: StripeDeliveryEstimatePaymentOptions;
  minimum?: StripeDeliveryEstimatePaymentOptions;
}

export interface StripeShippingOption {
  id: string;
  label: string;
  detail?: string;
  amount?: string;
  deliveryEstimate?: StripeDeliveryEstimateOptions;
}

export interface StripeUpdatePaymentRequestOptions {
  currency?: string;
  total?: ApplePayLineItem;
  displayItems?: Array<ApplePayLineItem>;
  shippingOptions?: Array<StripeShippingOption>;
}

export interface BraintreeApplePayInstance {
  createPaymentRequest: (options: any) => any;
  performValidation: (any) => any;
  tokenize: (any) => any;
}

export interface BraintreeMountOptions {
  requestBilling?: boolean;
  storeName?: string;
}

export type BraintreeApplePayOptions = StripePaymentRequestOptions & StripeMountOptions & BraintreeMountOptions;
export type BraintreeApplePaySession = any;
export type BraintreePaymentRequest = any;
export type BraintreeClientInstance = any;

export type CommmonApplePayOptions = StripePaymentRequestOptions & StripeMountOptions & BraintreeMountOptions;
export type CommonApplePaySession = any;
export type PaymentRequest = {
  merchantCapabilities?: Array<String>;
  supportedNetworks?: Array<String>;
  countryCode: String;
  requiredBillingContactFields: Array<String>;
  billingContact: Array<String>;
  requiredShippingContactFields: Array<String>;
  shippingContact: Array<String>;
  total: Object;
  lineItems: Array<Object>;
  currencyCode: String;
};

export interface AddressContact {
  addressLines?: Array<string>;
  administrativeArea?: string;
  country?: string;
  countryCode?: string;
  familyName?: string;
  givenName?: string;
  locality?: string;
  phoneticFamilyName?: string;
  phoneticGivenName?: string;
  postalCode?: string;
  subAdministrativeArea?: string;
  subLocality?: string;
  emailAddress?: string;
  phoneNumber?: string;
}
export interface ApplePaymentEvent {
  payment: {
    billingContact?: AddressContact;
    shippingContact?: AddressContact;
    token: {
      paymentData?: {
        data?: string;
        header?: object;
        signature?: string;
        version?: string;
      };
      paymentMethod?: {
        displayName?: string;
        network?: string; // card network - Ex. MasterCard
        type?: string; // card type - credit / debit
      };
      transactionIdentifier?: string;
    };
  };
}
export interface BraintreeDeviceDataCollectorInstance {
  deviceData: any;
}

export interface AdyenApplePayConfiguration {
  amount: object;
  countryCode: string;
  buttonType: string;
  buttonColor: string;
  recurringPaymentRequest?: ApplePayRecurringPaymentRequest;
  onClick: (resolve, reject) => Promise<unknown>;
  onValidateMerchant?: (resolve, reject, validationURL) => void;
  onSubmit: (state, dropin) => void;
  onAuthorized: (resolve, reject, event) => void;
  requiredBillingContactFields?: Array<string>;
  requiredShippingContactFields?: Array<string>;
}

export interface AdyenApplePayConfigurationV6 {
  amount: {
    currency: string;
    value: number;
  };
  buttonType: string;
  buttonColor: string;
  recurringPaymentRequest?: ApplePayRecurringPaymentRequest;
  onClick: (resolve, reject) => Promise<unknown>;
  onValidateMerchant?: (resolve, reject, validationURL) => void;
  onSubmit: (state, component, actions) => Promise<void>;
  onAuthorized: (data, actions) => void;
  onApplePayCodeClose: () => void;
  requiredBillingContactFields?: Array<string>;
  requiredShippingContactFields?: Array<string>;
}

export enum ApplePayButtonType {
  ADD_MONEY = 'add-money',
  BOOK = 'book',
  BUY = 'buy',
  CHECKOUT = 'check-out',
  CONTINUE = 'continue',
  CONTRIBUTE = 'contribute',
  DONATE = 'donate',
  ORDER = 'order',
  PAY = 'pay',
  PLAIN = 'plain',
  RELOAD = 'reload',
  RENT = 'rent',
  SETUP = 'set-up',
  SUBSCRIBE = 'subscribe',
  SUPPORT = 'support',
  TIP = 'tip',
  TOP_UP = 'top-up',
}

export enum ApplePayButtonColor {
  WHITE = 'white',
  WHITE_OUTLINE = 'white-outline',
  BLACK = 'black',
}

export type ApplePayMountOptions = {
  locale?: string;
  buttonType?: ApplePayButtonType;
  buttonColor?: ApplePayButtonColor;
  requestBilling?: boolean;
  requestShipping?: boolean;
  requestPayerEmail?: boolean;
  requestPayerName?: boolean;
  requestPayerPhone?: boolean;
  recurringPaymentRequest?: ApplePayRecurringPaymentRequest;
  onshippingmethodselected?: (event, callback: (update: ApplePayShippingMethodUpdate) => any) => void;
  onshippingcontactselected?: (event, callback: (update: ApplePayShippingContactUpdate) => any) => void;
  onpaymentmethodselected?: (event, callback: (update: ApplePayPaymentMethodUpdate) => any) => void;
};

export type ApplePayShippingMethodUpdate = {
  newTotal: ApplePayLineItem;
  newLineItems?: Array<ApplePayLineItem>;
};

export type ApplePayShippingContactUpdate = {
  newTotal: ApplePayLineItem;
  newLineItems?: Array<ApplePayLineItem>;
};

export type ApplePayPaymentMethodUpdate = {
  newTotal: ApplePayLineItem;
  newLineItems?: Array<ApplePayLineItem>;
};

export interface ApplePayRecurringPaymentRequest {
  paymentDescription: string;
  regularBilling: ApplePayLineItem;
  trialBilling?: ApplePayLineItem;
  billingAgreement?: string;
  managementURL: string;
  tokenNotificationURL?: string;
}

export interface PaymentCredentialStatusResponse {
  paymentCredentialStatus: PaymentCredentialStatus;
}
export enum ApplePayLineItemType {
  FINAL = 'final',
  PENDING = 'pending',
}

export enum ApplePayPaymentTiming {
  IMMEDIATE = 'immediate',
  RECURRING = 'recurring',
  DEFERRED = 'deferred',
  AUTOMATIC_RELOAD = 'automaticReload',
}

export enum ApplePayRecurringPaymentDateUnit {
  YEAR = 'year',
  MONTH = 'month',
  DAY = 'day',
  HOUR = 'hour',
  MINUTE = 'minute',
}

export enum PaymentCredentialStatus {
  PaymentCredentialsAvailable = 'paymentCredentialsAvailable',
  PaymentCredentialStatusUnknown = 'paymentCredentialStatusUnknown',
  PaymentCredentialsUnavailable = 'paymentCredentialsUnavailable',
  ApplePayUnsupported = 'applePayUnsupported',
}

export interface ApplePayLineItem {
  type?: ApplePayLineItemType;
  label: string;
  amount: string;
  paymentTiming?: ApplePayPaymentTiming;
  recurringPaymentStartDate?: Date; // Optional: Start date for recurring payments
  recurringPaymentIntervalUnit?: ApplePayRecurringPaymentDateUnit; // Unit for interval (year, month, etc.)
  recurringPaymentIntervalCount?: number; // Number of interval units between payments
  recurringPaymentEndDate?: Date; // Optional: End date for recurring payments
  deferredPaymentDate?: Date; // Optional: Date for deferred payment
  automaticReloadPaymentThresholdAmount?: string;
}
