export enum PageType {
  CHECKOUT,
  PORTAL,
}

export const Layout = {
  IN_APP: 'in_app',
  FULL_PAGE: 'full_page',
} as const;

export type Layout = (typeof Layout)[keyof typeof Layout];

export enum SectionType {
  SUBSCRIPTION_DETAILS = 'sub_details',
  SUBSCRIPTION_CANCELLATION = 'sub_cancel',
  EDIT_SUBSCRIPTION = 'edit_subscription',
  VIEW_SCHEDULED_CHANGES = 'scheduled_changes',
  ACCOUNT_DETAILS = 'account_details',
  EDIT_ACCOUNT_DETAILS = 'portal_edit_account',
  ADDRESS = 'portal_address',
  EDIT_BILLING_ADDRESS = 'portal_edit_billing_address',
  EDIT_SHIPPING_ADDRESS = 'portal_edit_shipping_address',
  EDIT_SUBSCRIPTION_CUSTOM_FIELDS = 'portal_edit_subscription_cf',
  PAYMENT_SOURCES = 'portal_payment_methods',
  ADD_PAYMENT_SOURCE = 'portal_add_payment_method',
  EDIT_PAYMENT_SOURCE = 'portal_edit_payment_method',
  VIEW_PAYMENT_SOURCE = 'portal_view_payment_method',
  CHOOSE_PAYMENT_METHOD_FOR_SUBSCRIPTION = 'portal_choose_payment_method',
  BILLING_HISTORY = 'portal_billing_history',
}

export const SectionTypeRaw = {
  SUBSCRIPTION_DETAILS: 'sub_details',
  SUBSCRIPTION_CANCELLATION: 'sub_cancel',
  EDIT_SUBSCRIPTION: 'edit_subscription',
  VIEW_SCHEDULED_CHANGES: 'scheduled_changes',
  ACCOUNT_DETAILS: 'account_details',
  EDIT_ACCOUNT_DETAILS: 'portal_edit_account',
  ADDRESS: 'portal_address',
  EDIT_BILLING_ADDRESS: 'portal_edit_billing_address',
  EDIT_SHIPPING_ADDRESS: 'portal_edit_shipping_address',
  EDIT_SUBSCRIPTION_CUSTOM_FIELDS: 'portal_edit_subscription_cf',
  PAYMENT_SOURCES: 'portal_payment_methods',
  ADD_PAYMENT_SOURCE: 'portal_add_payment_method',
  EDIT_PAYMENT_SOURCE: 'portal_edit_payment_method',
  VIEW_PAYMENT_SOURCE: 'portal_view_payment_method',
  CHOOSE_PAYMENT_METHOD_FOR_SUBSCRIPTION: 'portal_choose_payment_method',
  BILLING_HISTORY: 'portal_billing_history',
} as const;

export type SectionTypeRaw = (typeof SectionTypeRaw)[keyof typeof SectionTypeRaw];

export enum State {
  AUTH_INTITIATED,
  AUTHENTICATED,
}

// values in milliseconds
export enum PaymentRedirectTimeouts {
  DEFAULT = 600000,
  IDEAL = 600000,
  ONLINE_BANKING_POLAND = 600000,
  SOFORT = 600000,
  BANCONTACT = 600000,
  PAYCONIQ_BY_BANCONTACT = 600000,
  NETBANKING_EMANDATES = 600000,
  APPLEPAY = 600000,
  UPI = 300000,
  DIRECT_DEBIT = 600000,
  BOLETO = 600000,
  FASTER_PAYMENTS = 600000,
  PAY_TO = 600000,
  SEPA_INSTANT_TRANSFER = 600000,
  KLARNA_PAY_NOW = 600000,
  KLARNA = 600000,
  PAY_CO = 600000,
  GRAB_PAY = 600000,
  GO_PAY = 600000,
  TWINT = 600000,
  KBC_PAYMENT_BUTTON = 600000,
  ELECTRONIC_PAYMENT_STANDARD = 600000,
  TRUSTLY = 600000,
  PAY_BY_BANK = 600000,
  CASH_APP_PAY = 600000,
  WECHAT_PAY = 600000,
  ALIPAY = 600000,
  ALIPAY_HK = 600000,
  GCASH = 600000,
  STABLECOIN = 600000,
  KAKAO_PAY = 600000,
  NAVER_PAY = 600000,
  REVOLUT_PAY = 600000,
  PIX = 600000,
  PAYPAY = 600000,
  SOUTH_KOREAN_CARDS = 600000,
  SWISH = 60000,
  PAYME = 60000,
  DANA = 600000,
  TOUCH_N_GO = 600000,
  TAMARA = 600000,
  QPAY = 600000,
  BIZUM = 600000,
  PAYNOW = 3600000,
  PROMPTPAY = 3600000,
}

// values in milliseconds
export enum ThreeDSPollingTimeouts {
  DEFAULT = 600000,
}

// values in number
export enum ThreeDSPollingInterval {
  DEFAULT = ThreeDSPollingTimeouts.DEFAULT / 100,
}

export enum PageCategory {
  CHECKOUT_PAGE = 'Checkout Page',
  PORTAL_PAGE = 'Billing Portal',
}
