import {BrowserDetails} from '@/utils/payments/utils';

export enum PaymentIntentStatus {
  INITED = 'inited',
  IN_PROGRESS = 'in_progress',
  AUTHORIZED = 'authorized',
  CONSUMED = 'consumed',
}

export enum PaymentMethodType {
  CARD = 'card',
  IDEAL = 'ideal',
  SOFORT = 'sofort',
  BANCONTACT = 'bancontact',
  GOOGLE_PAY = 'google_pay',
  PAYPAL_EXPRESS_CHECKOUT = 'paypal_express_checkout',
  DOTPAY = 'dotpay',
  GIROPAY = 'giropay',
  Netbanking_EMANDATES = 'netbanking_emandates',
  APPLEPAY = 'apple_pay',
  UPI = 'upi',
  DIRECT_DEBIT = 'direct_debit',
  VENMO = 'venmo',
  BOLETO = 'boleto',
  FASTER_PAYMENTS = 'faster_payments',
  PAY_TO = 'pay_to',
  SEPA_INSTANT_TRANSFER = 'sepa_instant_transfer',
  KLARNA_PAY_NOW = 'klarna_pay_now',
  KLARNA = 'klarna',
  ONLINE_BANKING_POLAND = 'online_banking_poland',
  AMAZON_PAYMENTS = 'amazon_payments',
  APPLE_PAY = 'apple_pay',
  PAYCONIQ_BY_BANCONTACT = 'payconiq_by_bancontact',
  PAY_CO = 'pay_co',
  GRAB_PAY = 'grab_pay',
  GO_PAY = 'go_pay',
  TWINT = 'twint',
  KBC_PAYMENT_BUTTON = 'kbc_payment_button',
  ELECTRONIC_PAYMENT_STANDARD = 'electronic_payment_standard',
  TRUSTLY = 'trustly',
  PAY_BY_BANK = 'pay_by_bank',
  CASH_APP_PAY = 'cash_app_pay',
  WECHAT_PAY = 'wechat_pay',
  ALIPAY = 'alipay',
  ALIPAY_HK = 'alipay_hk',
  GCASH = 'gcash',
  STABLECOIN = 'stablecoin',
  KAKAO_PAY = 'kakao_pay',
  NAVER_PAY = 'naver_pay',
  REVOLUT_PAY = 'revolut_pay',
  SWISH = 'swish',
  PAYME = 'payme',
  PIX = 'pix',
  PAYPAY = 'paypay',
  SOUTH_KOREAN_CARDS = 'south_korean_cards',
  BIZUM = 'bizum',
  PAYNOW = 'paynow',
  PROMPTPAY = 'promptpay',
  DANA = 'dana',
  TOUCH_N_GO = 'touch_n_go',
  TAMARA = 'tamara',
  QPAY = 'qpay',
}

export enum AchVerificationType {
  INSTANT = 'instant',
  AUTOMATIC = 'automatic',
  MANUAL = 'manual',
}

export type PaymentIntent = {
  id: string;
  status: PaymentIntentStatus;
  amount: number;
  currency_code: string;
  gateway_account_id: string;
  gateway: Gateway;
  active_payment_attempt?: PaymentAttempt;
  customer_id?: string;
  reference_id?: string;
  payment_method_type: PaymentMethodType;
  success_url?: string;
  failure_url?: string;
  business_entity_id?: string;
  brand_id?: string;
  payer_info?: PayerInfo;
};

export enum PaymentAttemptStatus {
  INITED = 'inited',
  REQUIRES_IDENTIFICATION = 'requires_identification',
  REQUIRES_CHALLENGE = 'requires_challenge',
  REQUIRES_REDIRECTION = 'requires_redirection',
  AUTHORIZED = 'authorized',
  REFUSED = 'refused',
  PENDING_AUTHORIZATION = 'pending_authorization',
  PENDING_CONFIRMATION = 'pending_confirmation',
}

export type PaymentAttempt = {
  id: string;
  status: PaymentAttemptStatus;
  type: string;
  active: boolean;
  id_at_gateway?: string;
  action_payload: any;
  openpay_action_payload?: any;
  error_code?: string;
  error_text?: string;
  error_msg?: string;
  error_detail?: AttemptErrorDetail;
};

export type AttemptErrorDetail = {
  error_category: string;
  error_code: string;
  error_message: string;
  object: string;
  request_id: string;
};
// Gateway Instance
export type GatewayInstances = {
  stripe?: any;
  braintree?: any;
  adyen?: any;
};

// This type is deprecated, retained for backward compatability
export type Options = GatewayInstances;

export type PaymentInfo = {
  paymentComponent?: string; // payment component Field instance
  element?: any; // Hosted Field instance
  card?: CardInfo; // Raw card details
  tokenizer?: Function;
  cbToken?: string; // Chargebee Temp token
  cardComponent?: string;
  additionalData?: AdditionalData;
  retainPaymentMethod?: boolean;
};

export type Customer = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
};

export enum PaymentFlow {
  REDIRECT = 'REDIRECT',
}

export type AdditionalData = {
  cardBillingAddress?: Address; //  | -- Duplicate parameters
  billingAddress?: Address; //  |
  customerBillingAddress?: Address;
  shippingAddress?: Address;
  customer?: Customer;
  email?: string;
  phone?: string;
  plan?: string;
  additionalInformation?: any;
  document?: Document;
  cardType?: string;
  is3dsRequired?: boolean;

  // Adyen
  encryptedCardDetails?: string;

  // CBToken - Id at vault parameter
  vaultId?: string;

  //Options
  locale?: string;

  // RBI Mandate
  mandate?: Mandate;
  paymentType?: string;

  // For 3DS manual redirection
  callbacks?: {
    onChallenge?: (redirectUrl: string) => void;
  };

  // Braintree
  _skipRedirect?: boolean;

  // 3ds window size
  challengeWindowSize?: string;

  metaData?: {};

  // Request a charge-free payment method addition (variable enrollment / vaulting)
  allowPaylessPaymentMethodAddition?: boolean;
};

export type Document = {
  number?: string;
  type?: string;
};

export type Mandate = {
  requireMandate: boolean;
  description?: string;
};

export type Address = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  addressLine3?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  countryCode?: string;
  zip?: string | number;
};

export type CardInfo = {
  number: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  firstName?: string;
  lastName?: string;
  preferredScheme?: string;
};

export type Callbacks = {
  success?: Function;
  error?: Function;
  change?: Function;
  cancel?: Function;
  challenge?: Function;
  click?: Function; // only for wallet based payment methods (apple pay, gpay, paypal)
};

export type PaymentIntentResponse = {
  payment_intent: PaymentIntent;
  action_payload: any;
  openpay_action_payload?: any;
  payer_info?: PayerInfo;
};

export type PayerInfo = {
  customer?: Customer;
  shipping_address?: Address;
  billing_address?: Address;
  userName?: string;
};

export enum Gateway {
  STRIPE = 'stripe',
  ADYEN = 'adyen',
  BRAINTREE = 'braintree',
  SPREEDLY = 'spreedly',
  CHARGEBEE = 'chargebee',
  CHECKOUT_COM = 'checkout_com',
  CYBERSOURCE = 'cybersource',
  BLUESNAP = 'bluesnap',
  INGENICO_DIRECT = 'ingenico_direct',
  WORLDPAY = 'worldpay',
  AUTHORIZE_NET = 'authorize_net',
  MOLLIE = 'mollie',
  RAZORPAY = 'razorpay',
  CHARGEBEE_PAYMENTS = 'chargebee_payments',
  BANK_OF_AMERICA = 'bank_of_america',
  GOCARDLESS = 'gocardless',
  ECENTRIC = 'ecentric',
  METRICS_GLOBAL = 'metrics_global',
  WINDCAVE = 'windcave',
  EBANX = 'ebanx',
  AMAZON_PAYMENTS = 'amazon_payments',
  NMI = 'nmi',
  PAYCOM = 'pay_com',
  DLOCAL = 'dlocal',
  PAYPAL_EXPRESS_CHECKOUT = 'paypal_express_checkout',
  Nuvei = 'nuvei',
  PIN = 'pin',
  EWAY_RAPID = 'eway_rapid',
  BLUEPAY = 'bluepay',
  VANTIV = 'vantiv',
  GLOBAL_PAYMENTS = 'global_payments',
  PAYPAL = 'paypal',
  PAYSTACK = 'paystack',
  SOLIDGATE = 'solidgate',
  DEUTSCHE_BANK = 'deutsche_bank',
  EZIDEBIT = 'ezidebit',
  TEMPUS = 'tempus',
  MOYASAR = 'moyasar',
  PAYU = 'payu',
}

export interface ConfirmApiInputPayload extends AdditionalData {
  paymentFlow?: PaymentFlow;
  tmpToken?: string;
  cbToken?: string;
  reattempt?: Boolean;
  retainPaymentMethod?: boolean;
  requestSource?: string;
  paymentMethod?:
    | CardInfo
    | {
        id?: any;
        firstName?: string;
        lastName?: string;
        brand?: string;
      };
  cardComponent?: any;
  paymentComponent?: string;
  paymentMethodType?: PaymentMethodType;
  paymentIntent?: PaymentIntent;
  origin?: string;
  browserDetails?: BrowserDetails;
  additionalInfo?: {
    encryptedCardDetails?: string;
    metaData?: any;
    [key: string]: unknown;
  };

  paymentMethodDetails?: PaymentMethodDetails;
}

export interface TokenizeCardDataInputPayload extends ConfirmApiInputPayload {
  additionalData?: any;
}

export interface ThreeDsInfo {
  eci?: string;
  cryptogram?: string;
  xid?: string;
  version?: string;
  trxid?: string;
  cardholderAuth?: string;
}

export interface PaymentMethodDetails {
  card: CardInfo;
  firstName?: string;
  lastName?: string;
  brand?: string;
  cardComponent?: any;
  threeDsInfo?: ThreeDsInfo;
  paymentComponent?: any;
}

export interface ConfirmApiPayload {
  payload?: ConfirmApiInputPayload;
  paymentIntentId: string;
  businessEntityId?: string;
  brandId?: string;
  referenceId?: string;
  gatewayAccountId?: string;
  paymentMethodType?: PaymentMethodType;
}

export interface TokenizationCardPayload {
  payload?: TokenizeCardDataInputPayload;
  paymentIntentId: string;
  businessEntityId?: string;
  referenceId?: string;
}

export interface CancelPaymentIntentRequestPayload {
  paymentIntentId: string;
  reason?: string;
}

export type ValidateApplePaySessionPayload = {
  payload: {
    validationURL: string;
    domain: string;
  };
  paymentIntentId: string;
};

export type StripePaymentIntentParams = {
  client_secret: string;
  obj_type: string;
  publishable_key: string;
  redirect_url?: string;
};

export enum Orchestrator {
  PAYFURL = 'payfurl',
  SPREEDLY = 'spreedly',
}
