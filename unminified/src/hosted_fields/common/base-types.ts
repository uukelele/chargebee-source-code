import {
  PaymentIntent,
  Options,
  PaymentInfo,
  Callbacks,
  AdditionalData,
  Gateway,
} from '@/extensions/three_domain_secure/common/types';
import {PaymentInfo as NetbankingPaymentInfo} from '@/plugins/payments/netbanking_emandates/types';
import {PaymentInfo as OnlineBankingPolandPaymetInfo} from '@/plugins/payments/online_banking_poland/types';
import {PaymentInfo as BancontactPaymentInfo} from '@/plugins/payments/bancontact/types';
import {RenderOptions} from '@/plugins/payments/payconiq_by_bancontact/types';
import {RenderOptions as WechatPayRenderOptions} from '@/plugins/payments/wechat_pay/types';
import {PaymentInfo as UpiPaymentInfo} from '@/plugins/payments/upi/types';
import {PaymentInfo as DirectDebitPaymentInfo} from '@/plugins/payments/direct_debit/types';
import {PaymentInfo as BoletoPaymentInfo} from '@/plugins/payments/boleto/types';
import {PaymentInfo as KlarnaPayNowPaymentInfo} from '@/plugins/payments/klarna_pay_now/types';
import {PaymentInfo as KlarnaPaymentInfo} from '@/plugins/payments/klarna/types';
import {PaymentInfo as KakaoPayPaymentInfo} from '@/plugins/payments/kakao_pay/types';
import {PaymentInfo as NaverPayPaymentInfo} from '@/plugins/payments/naver_pay/types';
import {PaymentInfo as RevolutPayPaymentInfo} from '@/plugins/payments/revolut_pay/types';
import {PaymentInfo as AlipayPaymentInfo} from '@/plugins/payments/alipay/types';
import {PaymentInfo as AlipayHkPaymentInfo} from '@/plugins/payments/alipay_hk/types';
import {PaymentInfo as GcashPaymentInfo} from '@/plugins/payments/gcash/types';
import {PaymentInfo as WechatPayPaymentInfo} from '@/plugins/payments/wechat_pay/types';
import {PaymentInfo as CashAppPayPaymentInfo} from '@/plugins/payments/cash_app_pay/types';
import {RenderOptions as CashAppPayRenderOptions} from '@/plugins/payments/cash_app_pay/types';
import {PaymentInfo as PaypayPaymentInfo} from '@/plugins/payments/paypay/types';
import {PaymentInfo as SouthKoreanCardsPaymentInfo} from '@/plugins/payments/south_korean_cards/types';
import {ButtonOption} from '@/plugins/payments/google_pay/types';
import {Options as PaypalOptions} from '@/plugins/payments/paypal_express_checkout/types';
import {Options as VenmoOptions} from '@/plugins/payments/venmo/types';
import CbWindowManager from '@/models/cb-window-manager';
import {AccountHolderType, AccountType, Card, ComponentFieldType, Events, IDeal} from './enums';
import {ComponentOptions, EventMessage, FieldOptions, StyleBlock, Styles} from './types';
import ComponentField from '@/hosted_fields/host/component-field';
import CardComponent from '../host/card-component';
import IDealField from '../host/ideal-field';
import IDealComponent from '../host/ideal-component';
import {BillingAddress} from '@/plugins/functions/types';

export enum ComponentType {
  Card = 'card',
  Bank = 'bank_account',
  IDeal = 'ideal',
  Dotpay = 'dotpay',
  FasterPayments = 'faster_payments',
  PayTo = 'pay_to',
  SepaInstantTransfer = 'sepa_instant_transfer',
  Paypal = 'paypal',
  Netbanking = 'netbanking',
  Applepay = 'applepay',
  Venmo = 'venmo',
  OnlineBankingPoland = 'online_banking_ poland',
}

export const ComponentTypeRaw = {
  Card: 'card',
  Bank: 'bank_account',
  IDeal: 'ideal',
  Dotpay: 'dotpay',
  FasterPayments: 'faster_payments',
  PayTo: 'pay_to',
  SepaInstantTransfer: 'sepa_instant_transfer',
  Paypal: 'paypal',
  Netbanking: 'netbanking',
  Applepay: 'applepay',
  Venmo: 'venmo',
  OnlineBankingPoland: 'online_banking_ poland',
} as const;

export type ComponentTypeRaw = (typeof ComponentTypeRaw)[keyof typeof ComponentTypeRaw];

export interface BaseComponentField {
  at: (querySelector: string) => BaseComponentField;
  on: (eventType: string, callbackFunction: Function) => BaseComponentField;
  update: (options: {placeholder?: string; style?: Styles; ariaLabel?: string}) => BaseComponentField;
  focus: () => void;
  blur: () => void;
  clear: () => void;
  mount: (element: string | HTMLElement) => Promise<any>;
}

export interface Component {
  name: string;
  type: ComponentType;
  createField?: (fieldType: ComponentFieldType, fieldOptions: FieldOptions) => BaseComponentField;
  mount(element?: string | HTMLElement): Promise<boolean>;
  framesCreated(): string[];
  delegateEvent(event): void;
  isMounted?: () => boolean;
  deregister?: (string) => void;
  on?: (eventType: Events, eventCallback: Function) => Component;
  focus?: () => void;
  blur?: () => void;
  clear?: () => void;
  update?: (options: ComponentOptions) => void;
  framesCreated(): string[];
  delegateEvent(data: EventMessage): void;
  destroy?: () => Promise<void | boolean[]>;
  tokenize?: (additionalData?: {
    firstName?: string;
    lastName?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    stateCode?: string;
    zip?: string;
    countryCode?: string;
  }) => Promise<CbToken>;
  authorizeWith3ds?: (
    paymentIntent: PaymentIntent,
    additionalData?: AdditionalData,
    callbacks?: {
      change?: Function;
      success?: Function;
      error?: Function;
      challenge?: Function;
    }
  ) => Promise<object>;
  validateCardDetails?: () => Promise<boolean>;
}

interface CbToken {
  token: string;
}

export interface CardComponentInterface extends Component {
  tokenize(data?);
  authorizeWith3ds(
    paymentIntent: PaymentIntent,
    additionalData: AdditionalData,
    callbacks: Callbacks
  ): Promise<PaymentIntent>;
  createField(fieldType: Card.ComponentFieldType, fieldOptions: FieldOptions): ComponentField;
  at(domElement: string | HTMLElement): CardComponent;
}

export interface IdealComponentInterface extends Component {
  tokenize(data?);
  authorizeWith3ds(
    paymentIntent: PaymentIntent,
    additionalData: AdditionalData,
    callbacks: Callbacks
  ): Promise<PaymentIntent>;
  createField(fieldType: IDeal.ComponentFieldType, fieldOptions: FieldOptions): IDealField;
  at(domElement: string | HTMLElement): IDealComponent;
}

export interface ThreeDSHandler {
  setPaymentIntent(paymentIntent: PaymentIntent, options: Options);
  updatePaymentIntent(paymentIntent);
  handleCardPayment(paymentInfo: PaymentInfo, callbacks?: Callbacks): Promise<PaymentIntent>;
  cancel(reason?: string): Promise<PaymentIntent>;
  getPaymentIntent(): PaymentIntent;
  openNewWindow(): void;
}

export interface IDealPayment extends SelectBank, RedirectPayment {}

export interface SofortPayment extends RedirectPayment {}

export interface PayCoPayment {
  setPaymentIntent(paymentIntent: PaymentIntent, options: Options);
  updatePaymentIntent(paymentIntent: PaymentIntent);
  getPaymentIntent(): PaymentIntent;
  handlePayment(paymentInfo: BasePaymentInfo, callbacks?: Callbacks): Promise<any>;
}

export interface StablecoinPayment extends RedirectPayment {}

export interface GiropayPayment extends RedirectPayment {}

export interface DotpayPayment extends SelectBank, RedirectPayment {}

export interface FasterPymtsPayment extends SelectBank, RedirectPayment {}

export interface PayToPayment extends RedirectPayment {}

export interface SepaInstantTransferPayment extends SelectBank, RedirectPayment {}

export interface PayByBankPayment extends RedirectPayment {}

export interface TrustlyPayment extends RedirectPayment {}

export interface KbcPaymentButtonPayment extends RedirectPayment {}

export interface ElectronicPaymentStandardPayment extends RedirectPayment {}

export interface AlipayHkPayment extends RedirectPayment {}

export interface GcashPayment extends RedirectPayment {}

interface SelectBank {
  mountBankList(id: string, options?: any): Promise<any>;
  getSelectedBank(): any;
}

export interface RedirectPayment extends PaymentMethod {
  setWindowManager(windowManager: CbWindowManager);
  setRedirectMode(val: boolean);
}

export interface PaymentMethod {
  handlePayment(options: PaymentOptions): Promise<any>;
}

export interface GooglePayment {
  mountPaymentButton(id: string, style?: ButtonOption): Promise<any>;
  setPaymentIntent(paymentIntent: PaymentIntent, options: Options);
  updatePaymentIntent(paymentIntent: PaymentIntent);
  getPaymentIntent(): PaymentIntent;
  handlePayment(callbacks?: Callbacks): Promise<any>;
}

export interface PaypalPayment {
  mountPaymentButton(id: string, option: PaypalOptions): Promise<any>;
  setPaymentIntent(paymentIntent: PaymentIntent, options: Options);
  updatePaymentIntent(paymentIntent: PaymentIntent);
  getPaymentIntent(): PaymentIntent;
  handlePayment(callbacks?: Callbacks): Promise<PaymentIntent>;
}

export interface VenmoPayment {
  mountPaymentButton(id: string, option: VenmoOptions): Promise<any>;
  setPaymentIntent(paymentIntent: PaymentIntent, options: Options);
  updatePaymentIntent(paymentIntent: PaymentIntent);
  getPaymentIntent(): PaymentIntent;
  handlePayment(callbacks?: Callbacks): Promise<PaymentIntent>;
}

export interface BancontactPayment {
  setPaymentIntent(paymentIntent: PaymentIntent, options: Options);
  updatePaymentIntent(paymentIntent: PaymentIntent);
  getPaymentIntent(): PaymentIntent;
  handlePayment(paymentInfo: BancontactPaymentInfo, callbacks?: Callbacks): Promise<any>;
}

export interface PayconiqByBancontactPayment {
  setPaymentIntent(paymentIntent: PaymentIntent, options: Options);
  getPaymentIntent(): PaymentIntent;
  handlePayment(options: RenderOptions | PaymentOptions, callbacks?: Callbacks): Promise<any>;
}

export interface NetbankingPayment {
  setPaymentIntent(paymentIntent: PaymentIntent, options: Options);
  getPaymentIntent(): PaymentIntent;
  handlePayment(paymentInfo: NetbankingPaymentInfo, callbacks?: Callbacks): Promise<any>;
  fetchBankList(options?: any): Promise<any>;
}

export interface OnlineBankingPolandPayment {
  setPaymentIntent(paymentIntent: PaymentIntent, options: Options);
  getPaymentIntent(): PaymentIntent;
  handlePayment(paymentInfo: OnlineBankingPolandPaymetInfo, callbacks?: Callbacks): Promise<any>;
  fetchBankList(options?: any): Promise<any>;
}

export interface KlarnaPayNowPayment {
  setPaymentIntent(paymentIntent: PaymentIntent, options: Options);
  updatePaymentIntent(paymentIntent: PaymentIntent);
  getPaymentIntent(): PaymentIntent;
  handlePayment(paymentInfo: KlarnaPayNowPaymentInfo, callbacks?: Callbacks): Promise<any>;
}

export interface KakaoPayPayment {
  setPaymentIntent(paymentIntent: PaymentIntent, options: Options);
  updatePaymentIntent(paymentIntent: PaymentIntent);
  getPaymentIntent(): PaymentIntent;
  handlePayment(paymentInfo: KakaoPayPaymentInfo, callbacks?: Callbacks): Promise<any>;
}

export interface NaverPayPayment {
  setPaymentIntent(paymentIntent: PaymentIntent, options: Options);
  updatePaymentIntent(paymentIntent: PaymentIntent);
  getPaymentIntent(): PaymentIntent;
  handlePayment(paymentInfo: PaymentOptions, callbacks?: Callbacks): Promise<any>;
}

export interface PaymePayment {
  setPaymentIntent(paymentIntent: PaymentIntent, options: Options);
  updatePaymentIntent(paymentIntent: PaymentIntent);
  getPaymentIntent(): PaymentIntent;
  handlePayment(paymentInfo: PaymentOptions): Promise<any>;
}

export interface SwishPayment {
  setPaymentIntent(paymentIntent: PaymentIntent, options: Options);
  updatePaymentIntent(paymentIntent: PaymentIntent);
  getPaymentIntent(): PaymentIntent;
  handlePayment(paymentInfo: NaverPayPaymentInfo): Promise<any>;
}

export interface KlarnaPayment {
  setPaymentIntent(paymentIntent: PaymentIntent, options: Options);
  updatePaymentIntent(paymentIntent: PaymentIntent);
  getPaymentIntent(): PaymentIntent;
  handlePayment(paymentInfo: KlarnaPaymentInfo, callbacks?: Callbacks): Promise<any>;
}

export interface RevolutPayPayment {
  setPaymentIntent(paymentIntent: PaymentIntent, options: Options);
  updatePaymentIntent(paymentIntent: PaymentIntent);
  getPaymentIntent(): PaymentIntent;
  handlePayment(paymentInfo: RevolutPayPaymentInfo, callbacks?: Callbacks): Promise<any>;
}

export interface AlipayPayment {
  setPaymentIntent(paymentIntent: PaymentIntent, options: Options);
  updatePaymentIntent(paymentIntent: PaymentIntent);
  getPaymentIntent(): PaymentIntent;
  handlePayment(paymentInfo: AlipayPaymentInfo, callbacks?: Callbacks): Promise<any>;
}

export interface PixPayment {
  setPaymentIntent(paymentIntent: PaymentIntent, options: Options);
  updatePaymentIntent(paymentIntent: PaymentIntent);
  getPaymentIntent(): PaymentIntent;
  handlePayment(paymentInfo: BasePaymentInfo, callbacks?: Callbacks): Promise<any>;
}

export interface WechatPayPayment {
  setPaymentIntent(paymentIntent: PaymentIntent, options: Options);
  updatePaymentIntent(paymentIntent: PaymentIntent);
  getPaymentIntent(): PaymentIntent;
  handlePayment(options: WechatPayRenderOptions, callbacks?: Callbacks): Promise<any>;
}

export interface BizumPayment {
  setPaymentIntent(paymentIntent: PaymentIntent, options: Options);
  updatePaymentIntent(paymentIntent: PaymentIntent);
  getPaymentIntent(): PaymentIntent;
  handlePayment(options: PaymentOptions): Promise<any>;
}

export interface PayNowPayment {
  setPaymentIntent(paymentIntent: PaymentIntent, options: Options);
  updatePaymentIntent(paymentIntent: PaymentIntent);
  getPaymentIntent(): PaymentIntent;
  handlePayment(options: PaymentOptions): Promise<any>;
}

export interface PromptPayPayment {
  setPaymentIntent(paymentIntent: PaymentIntent, options: Options);
  updatePaymentIntent(paymentIntent: PaymentIntent);
  getPaymentIntent(): PaymentIntent;
  handlePayment(options: PaymentOptions): Promise<any>;
}

export interface CashAppPayPayment {
  setPaymentIntent(paymentIntent: PaymentIntent, options: Options);
  updatePaymentIntent(paymentIntent: PaymentIntent);
  getPaymentIntent(): PaymentIntent;
  handlePayment(options: CashAppPayRenderOptions, callbacks?: Callbacks): Promise<any>;
}

export interface PaypayPayment {
  setPaymentIntent(paymentIntent: PaymentIntent, options: Options);
  updatePaymentIntent(paymentIntent: PaymentIntent);
  getPaymentIntent(): PaymentIntent;
  handlePayment(paymentInfo: PaypayPaymentInfo, callbacks?: Callbacks): Promise<any>;
}

export interface SouthKoreanCardsPayment {
  setPaymentIntent(paymentIntent: PaymentIntent, options: Options);
  updatePaymentIntent(paymentIntent: PaymentIntent);
  getPaymentIntent(): PaymentIntent;
  handlePayment(paymentInfo: SouthKoreanCardsPaymentInfo, callbacks?: Callbacks): Promise<any>;
}
export interface TwintPayment {
  setPaymentIntent(paymentIntent: PaymentIntent, options: Options);
  updatePaymentIntent(paymentIntent: PaymentIntent);
  getPaymentIntent(): PaymentIntent;
  handlePayment(paymentInfo: BasePaymentInfo, callbacks?: Callbacks): Promise<any>;
}

export interface GoPayPayment {
  setPaymentIntent(paymentIntent: PaymentIntent, options: Options);
  updatePaymentIntent(paymentIntent: PaymentIntent);
  getPaymentIntent(): PaymentIntent;
  handlePayment(paymentInfo: BasePaymentInfo, callbacks?: Callbacks): Promise<any>;
}

export interface GrabPayPayment {
  setPaymentIntent(paymentIntent: PaymentIntent, options: Options);
  updatePaymentIntent(paymentIntent: PaymentIntent);
  getPaymentIntent(): PaymentIntent;
  handlePayment(paymentInfo: BasePaymentInfo, callbacks?: Callbacks): Promise<any>;
}

export interface Subscription {
  startDate: number;
  endDate: number;
  frequencyUnit: FrequencyUnit;
  frequencyPeriod: number;
}

export interface PaymentAddress {
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
}

export interface BasePaymentInfo {
  element?: object;
  card?: {
    number: string;
    expiryMonth: string;
    expiryYear: string;
    cvv?: string;
    firstName?: string;
    lastName?: string;
  };
  tokenizer?: Function;
  cbToken?: string;
  currencyCode?: string;
  amount?: number;
  issuerBank?: string;
  userName?: string;
  userEmail?: string;
  country?: string;
  plaid?: {
    userId?: string;
    locale?: string;
  };
  useGateway?: boolean;
  customer?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    billingAddress?: PaymentAddress;
  };
  bankAccount?: {
    bank?: string;
    beneficiaryName?: string;
    accountNumber?: string;
    accountType?: AccountType;
    ifscCode?: string;
    iban?: string;
    nameOnAccount?: string;
    routingNumber?: string;
    accountHolderType?: AccountHolderType;
    bankCode?: string;
    countryCode?: string;
    swedishIdentityNumber?: string;
  };
  vpa?: string;
  additionalData?: {
    plan?: string;
    billingAddress?: PaymentAddress;
    customerBillingAddress?: PaymentAddress;
    shippingAddress?: PaymentAddress;
    email?: string;
    phone?: string;
    mandate?: {
      requireMandate?: boolean;
      description?: string;
    };
    subscription?: Subscription;
    document?: Document;
  };
  lineItems?: Array<any>;
}

export type PaymentOptions = {
  paymentIntent: Function;
  paymentInfo?: BasePaymentInfo;
  callbacks?: Callbacks;
  redirectMode?: boolean;
  iframeMode?: boolean;
  mandateText?: string;
  gatewayCredentials?: any;
};

export enum FrequencyUnit {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}

export type Document = {
  type?: string;
  number?: string;
};

export enum TabRedirectPayments {
  ideal,
  sofort,
  giropay,
  dotpay,
  bancontact,
  direct_debit,
  faster_payments,
  pay_to,
  sepa_instant_transfer,
  klarna_pay_now,
  klarna,
  pay_co,
  grab_pay,
  go_pay,
  twint,
  kbc_payment_button,
  electronic_payment_standard,
  trustly,
  pay_by_bank,
  payconiq_by_bancontact,
  stablecoin,
  cash_app_pay,
  wechat_pay,
  alipay,
  kakao_pay,
  naver_pay,
  revolut_pay,
  pix,
  paypay,
  south_korean_cards,
  alipay_hk,
  gcash,
  bizum,
  paynow,
  promptpay,
}

export const PAYMENT_AUTH_REDIRECT_WINDOW_NAME = 'cb_payment_auth_redirect_window';
export interface ApplePayment {
  handlePayment(callbacks?: Callbacks): Promise<any>;
  isApplePayQRFlowSupported(): boolean;
}

export interface UpiPayment {
  setPaymentIntent(paymentIntent: PaymentIntent, options: Options);
  updatePaymentIntent(paymentIntent: PaymentIntent);
  getPaymentIntent(): PaymentIntent;
  handlePayment(paymentInfo: UpiPaymentInfo, callbacks?: Callbacks): Promise<any>;
  fetchUpiInstalledAppList(): Promise<any>;
}

export interface DirectDebitPayment {
  setPaymentIntent(paymentIntent: PaymentIntent, options: Options);
  updatePaymentIntent(paymentIntent: PaymentIntent);
  getPaymentIntent(): PaymentIntent;
  handlePayment(paymentInfo: DirectDebitPaymentInfo, callbacks?: Callbacks): Promise<any>;
}

export interface TestCardsHandlerInterface {
  setTestCards: Function;
  renderTestCards: Function;
  hasTestCards: Function;
  show: Function;
  hide: Function;
}

export interface BoletoPayment {
  setPaymentIntent(paymentIntent: PaymentIntent, options: Options);
  updatePaymentIntent(paymentIntent: PaymentIntent);
  getPaymentIntent(): PaymentIntent;
  handlePayment(paymentInfo: BoletoPaymentInfo, callbacks?: Callbacks): Promise<any>;
}

export interface AmazonPayPayment {
  setPaymentIntent(paymentIntent: PaymentIntent, options: Options);
  updatePaymentIntent(paymentIntent: PaymentIntent);
  getPaymentIntent(): PaymentIntent;
  handlePayment(callbacks?: Callbacks): Promise<any>;
}
