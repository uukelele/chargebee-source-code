export namespace Master {
  export enum Actions {
    LoadPlugin = 'loadPlugin',

    RegisterMaster = 'registerMaster',
    RegisterComponent = 'registerComponent',
    TokenizeCardData = 'tokenizeCardData',
    TokenizeBankData = 'tokenizeBankData',
    RelayEvent = 'relayEvent',
    Broadcast = 'broadcast',
    CaptureException = 'captureException',
    CaptureKVL = 'captureKVL',
    SetBusinessEntity = 'setBusinessEntity',
    SetBrand = 'setBrand',

    /** Field related actions */
    RegisterField = 'registerField',
    Update = 'update',
    Focus = 'focus',
    Blur = 'blur',
    Clear = 'clear',
    Destroy = 'destroy',
    Validate = 'validate',
    KeyPress = 'keyPress',
    WhitelistFonts = 'whitelistFonts',
    UpdateStyles = 'updateStyles',
    UpdatePlaceholder = 'updatePlaceholder',
    UpdateAriaLabel = 'updateAriaLabel',
    UpdateIcon = 'updateIcon',
    UpdateLocale = 'updateLocale',
    IDealFocus = 'iDealFocus',
    IDealBlur = 'iDealBlur',

    FocusIDealSelect = 'focusIDealSelect',
    IDealBankSelected = 'iDealBankSelected',

    /* ThreeDS Actions */
    RetrievePaymentIntent = 'retrievePaymentIntent',
    ConfirmPaymentIntent = 'confirmPaymentIntent',
    tokenizePaymentComponentCard = 'tokenizePaymentComponentCard',
    CancelPaymentIntent = 'cancelPaymentIntent',
    FetchGatewayCredential = 'fetchGatewayCredential',
    FetchGatewayToken = 'FetchGatewayToken',
    GenerateBraintreeClientToken = 'generateBraintreeClientToken',
    CreateBluesnapPfToken = 'createBluesnapPfToken',
    CreatePaypalVaultSetupToken = 'createPaypalVaultSetupToken',
    GenerateDeviceDataJWT = 'generateDeviceDataJWT',
    PollAdyen3DS1 = 'pollAdyen3DS1',
    PollCheckoutCom3DS = 'pollCheckoutCom3DS',
    PollCybersource3DS = 'pollCybersource3DS',
    SetAdyen3DS1VerificationResult = 'setAdyen3DS1VerificationResult',
    SetCheckoutCom3DSVerificationResult = 'setCheckoutCom3DSVerificationResult',
    SetCybersource3DSVerificationResult = 'setCybersource3DSVerificationResult',
    GenerateAdyenOriginKey = 'generateAdyenOriginKey',
    SetPaymentIntent3DSResult = 'setPaymentIntent3DSResult',
    PollPaymentIntent3DSResult = 'pollPaymentIntent3DSResult',
    PollPaymentIntentResultBeforeRequiresChallenge = 'pollPaymentIntentResultBeforeRequiresChallenge',
    StopPollPaymentIntent3DSResult = 'stopPollPaymentIntent3DSResult',
    SetupWorker = 'setupWorker',
    RetrieveBraintreePaymentMethodNonce = 'RetrieveBraintreePaymentMethodNonce',

    /**
     * iDeal Actions
     */
    PollAdyenIDeal = 'pollAdyenIDeal',
    StopAdyenIDealPoll = 'stopAdyenIDealPoll',
    SetAdyenIDealVerificationResult = 'setAdyenIDealVerificationResult',
    GetIDealGatewayDetails = 'getIDealGatewayDetails',
    UpdateIDealBankList = 'updateIDealBankList',
    PollStripeIDeal = 'pollStripeIDeal',
    StopStripeIDealPoll = 'stopStripeIDealPoll',
    SetStripeIDealVerificationResult = 'setStripeIDealVerificationResult',

    /**
     * Sofort Actions
     */
    PollAdyenSofort = 'pollAdyenSofort',
    StopAdyenSofortPoll = 'stopAdyenSofortPoll',
    SetAdyenSofortVerificationResult = 'setAdyenSofortVerificationResult',

    /**
     * Bancontact Actions
     */
    PollAdyenBancontact = 'pollAdyenBancontact',
    StopAdyenBancontactPoll = 'stopAdyenBancontactPoll',
    SetAdyenBancontactVerificationResult = 'setAdyenBancontactVerificationResult',

    /**
     * Giropay Actions
     */
    PollAdyenGiropay = 'pollAdyenGiropay',
    StopAdyenGiropayPoll = 'stopAdyenGiropayPoll',
    SetAdyenGiropayVerificationResult = 'setAdyenGiropayVerificationResult',

    /**
     * Dotpay Actions
     */
    GetDotpayGatewayDetails = 'getDotpayGatewayDetails',
    PollAdyenDotpay = 'pollAdyenDotpay',
    StopAdyenDotpayPoll = 'stopAdyenDotpayPoll',
    SetAdyenDotpayVerificationResult = 'setAdyenDotpayVerificationResult',

    /**
     * FasterPayments Actions
     */
    GetFasterPaymentsGatewayDetails = 'getFasterPaymentsGatewayDetails',

    /**
     * PayTo Actions
     */
    GetPayToGatewayDetails = 'getPayToGatewayDetails',

    /**
     * SepaInstantTransfer Actions
     */
    GetSepaInstantTransferGatewayDetails = 'getSepaInstantTransferGatewayDetails',

    // Checkout utils
    LoadJsInfo = 'loadJsInfo',
    PortalLogout = 'portalLogout',
    SetHpData = 'setHpData',
    GetHpData = 'getHpData',

    GetBinData = 'getBinData',

    // Chargebee Functions
    // Estimates
    CreateSubscriptionEstimate = 'createSubscriptionEstimate',
    UpdateSubscriptionEstimate = 'updateSubscriptionEstimate',
    RenewSubscriptionEstimate = 'renewSubscriptionEstimate',

    // Vat Validation
    ValidateVat = 'validateVat',
    GetTranslations = 'getTranslations',

    // Direct debit Actions
    FetchPlaidLinkToken = 'fetchPlaidLinkToken',

    FetchGWPaymentMethodConfig = 'FetchGWPaymentMethodConfig',

    // apple pay actions
    ValidateApplePaySession = 'ValidateApplePaySession',

    // test cards
    selectTestCard = 'selectTestCard',

    // Captcha
    InitializeCaptcha = 'InitializeCaptcha',
    GenerateCaptchaToken = 'GenerateCaptchaToken',

    // Amazon Payments
    FetchAmazonPayButtonSignature = 'FetchAmazonPayButtonSignature',
  }
}

export namespace Child {
  export enum Actions {
    LoadComponent = 'loadComponent',
    FetchData = 'fetchData',
    ReceiveStatusBroadcast = 'receiveStatus',
    Update = 'update',
    Focus = 'focus',
    Blur = 'blur',
    Clear = 'clear',
    Destroy = 'destroy',
    Validate = 'validate',
    UpdateFonts = 'updateFonts',
    UpdateStyles = 'updateStyles',
    UpdatePlaceholder = 'updatePlaceholder',
    UpdateAriaLabel = 'updateAriaLabel',
    UpdateIcon = 'updateIcon',
    UpdateLocale = 'updateLocale',
    IDealFocus = 'iDealFocus',
    IDealBlur = 'iDealBlur',
    UpdateIDealBankList = 'updateIDealBankList',
    IDealBankSelected = 'iDealBankSelected',
    selectTestCard = 'selectTestCard',
    sendConfigData = 'sendConfigData',
    FetchCardData = 'fetchCardData',
  }
}

export namespace Host {
  export enum Actions {
    TriggerEvent = 'triggerEvent',
    ReceiveStatusBroadcast = 'receiveStatus',
    SetPaymentIntent3DSResult = 'setPaymentIntent3DSResult',
    SetAdyen3DS1VerificationResult = 'setAdyen3DS1VerificationResult',
    SetCheckoutCom3DSVerificationResult = 'setCheckoutCom3DSVerificationResult',
    SetAdyenIDealVerificationResult = 'setAdyenIDealVerificationResult',
    SetStripeIDealVerificationResult = 'setStripeIDealVerificationResult',
    SetAdyenSofortVerificationResult = 'setAdyenSofortVerificationResult',
    SetAdyenBancontactVerificationResult = 'setAdyenBancontactVerificationResult',
    SetAdyenGiropayVerificationResult = 'setAdyenGiropayVerificationResult',
    SetAdyenDotpayVerificationResult = 'setAdyenDotpayVerificationResult',
    SetFrameLoaded = 'setFrameLoaded',
    CaptureKVL = 'captureKVL',
    CaptureException = 'captureException',
    ShowFrame = 'showFrame',
    HideFrame = 'hideFrame',

    // Checkout utils
    SetCustomerHandle = 'setCustomerHandle',
    SetAuthToken = 'setAuthToken',
    SetPreviewPortalEmail = 'setPreviewPortalEmail',
    GetPreviewPortalEmail = 'getPreviewPortalEmail',

    //
    setTestCards = 'setTestCards',
  }
}

export enum WindowType {
  Master,
  Component,
  Host,
}

export enum MessageHandler {
  Client = 'client',
  Receiver = 'Receiver',
}

export enum CardIconPosition {
  START = 'start',
  END = 'end',
}

export enum Field {
  Number = 'cardnumber',
  Expiry = 'exp-date',
  CVV = 'cvc',
  PREFERRED_NETWORK = 'preferred-network',

  IDealBankList = 'ideal-bank-list',
  IDealBankSelect = 'ideal-bank-select',

  ACCOUNT_NUMBER = 'accountNumber',
  ROUTING_NUMBER = 'routingNumber',
  NAME_ON_ACCOUNT = 'nameOnAccount',
  ACCOUNT_TYPE = 'accountType',

  FIRST_NAME = 'firstName',
  LAST_NAME = 'lastName',

  // Deprecated billing fields
  BILLING_ADDR1 = 'billingAddr1',
  BILLING_ADDR2 = 'billingAddr2',
  BILLING_CITY = 'billingCity',
  BILLING_STATE = 'billingState',
  BILLING_STATE_CODE = 'billingStateCode',
  BILLING_ZIP = 'billingZip',
  BILLING_COUNTRY = 'billingCountry',

  // After renaming the billing fields (to support both versions)
  BILLING_PHONE = 'phone',
  BILLING_ADDRESS_LINE1 = 'addressLine1',
  BILLING_ADDRESS_LINE2 = 'addressLine2',
  BILLING_ADDRESS_LINE3 = 'addressLine3',
  BILLING_CITY2 = 'city',
  BILLING_STATE2 = 'state',
  BILLING_STATECODE = 'stateCode',
  BILLING_COUNTRYCODE = 'countryCode',
  BILLING_ZIPCODE = 'zip',

  DOCUMENT_ID = 'document_id',
  NAME = 'name',
  EMAIL = 'email',
}

export enum Entity {
  field = 'field',
  component = 'component',
}

export namespace Card {
  export enum ComponentFieldType {
    Combined = 'combined',
    Number = 'number',
    CVV = 'cvv',
    Expiry = 'expiry',
  }
}

export namespace IDeal {
  export enum ComponentFieldType {
    BankSelect = 'bank-select',
    BankList = 'bank-list',
  }
}

export namespace Bank {
  export enum ComponentFieldType {}
}

export enum ComponentMountStatus {
  Created,
  Mounting,
  Mounted,
}

export const Events = {
  blur: 'blur',
  focus: 'focus',
  error: 'error',
  change: 'change',
  ready: 'ready',
  setTranslations: 'setTranslations',
  setTestCards: 'setTestCards',
  keyPress: 'keyPress',
} as const;

export type Events = (typeof Events)[keyof typeof Events];

export const AccountType = {
  CHECKING: 'CHECKING',
  SAVINGS: 'SAVINGS',
  BUSINESS_CHECKING: 'BUSINESS_CHECKING',
  CURRENT: 'CURRENT',
} as const;

export type AccountType = (typeof AccountType)[keyof typeof AccountType];

export const AccountHolderType = {
  INDIVIDUAL: 'INDIVIDUAL',
  COMPANY: 'COMPANY',
} as const;

export type AccountHolderType = (typeof AccountHolderType)[keyof typeof AccountHolderType];

export const ComponentFieldType = {
  BANK_SELECT: 'bank-select',
  BANK_LIST: 'bank-list',
  COMBINED: 'combined',
  NUMBER: 'number',
  CVV: 'cvv',
  EXPIRY: 'expiry',
} as const;

export type ComponentFieldType = (typeof ComponentFieldType)[keyof typeof ComponentFieldType];

export const HostedPageType = {
  CHECKOUT_NEW: 'checkout_new',
  CHECKOUT_EXISTING: 'checkout_existing',
  UPDATE_PAYMENT_METHOD: 'update_payment_method',
  MANAGE_PAYMENT_SOURCES: 'manage_payment_sources',
  COLLECT_NOW: 'collect_now',
  EXTEND_SUBSCRIPTION: 'extend_subscription',
  CHECKOUT_ONE_TIME: 'checkout_one_time',
  PRE_CANCEL: 'pre_cancel',
  VIEW_VOUCHER: 'view_voucher',
} as const;

export type HostedPageType = (typeof HostedPageType)[keyof typeof HostedPageType];

export const HostedPageState = {
  CREATED: 'created',
  REQUESTED: 'requested',
  SUCCEEDED: 'succeeded',
  CANCELLED: 'cancelled',
  ACKNOWLEDGED: 'acknowledged',
};

export type HostedPageState = (typeof HostedPageState)[keyof typeof HostedPageState];

export enum EventKeys {
  escape = 'Escape',
}

// Field state classnames for container element (HOST)
export enum FieldState {
  focus = 'CbHosted--focus',
  complete = 'CbHosted--complete',
  invalid = 'CbHosted--invalid',
  empty = 'CbHosted--empty',
  valid = 'CbHosted--valid',
}

export namespace HostedFields {
  // External field state classes - provided by user
  export enum CSSClass {
    focus = 'focus',
    empty = 'empty',
    invalid = 'invalid',
    complete = 'complete',
  }

  export enum InternalCSSClass {
    focus = 'is-focused',
    empty = 'is-empty',
    invalid = 'is-invalid',
    complete = 'is-complete',
    valid = 'is-valid',
  }

  // Top level options
  export enum Options {
    currency = 'currency',
    classes = 'classes',
    style = 'style',
    fonts = 'fonts',
    locale = 'locale',
    placeholder = 'placeholder',
    field = 'field',
    icon = 'icon',
    ariaLabel = 'ariaLabel',
  }

  export enum StyleSections {
    base = 'base',
    invalid = 'invalid',
    empty = 'empty',
  }

  export enum CustomCSSProperty {
    iconColor = 'iconColor',
  }

  export enum StdCSSProperty {
    color = 'color',
    background = 'background',
    backgroundColor = 'backgroundColor',
    letterSpacing = 'letterSpacing',

    textAlign = 'textAlign',
    textTransform = 'textTransform',
    textDecoration = 'textDecoration',
    textShadow = 'textShadow',

    lineHeight = 'lineHeight',

    webkitTextColor = 'webkitTextColor',
  }

  export enum FontProperty {
    src = 'src',
    fontFamily = 'fontFamily',
    fontSize = 'fontSize',
    fontSmoothing = 'fontSmoothing',
    fontStyle = 'fontStyle',
    fontWeight = 'fontWeight',
    fontVariant = 'fontVariant',
  }

  export enum PseudoCSSProperty {
    hover = ':hover',
    focus = ':focus',
    disabled = ':disabled',
    placeholder = '::placeholder',
    selection = '::selection',
    autofill = ':-webkit-autofill',
    focusPlaceholder = ':focus::placeholder',
  }

  export enum Placeholder {
    number = 'number',
    expiry = 'expiry',
    cvv = 'cvv',
  }

  export enum FieldOption {
    required = 'required',
    show = 'show',
  }

  export enum Field {
    cvv = 'cvv',
  }

  export enum AriaLabel {
    number = 'number',
    expiry = 'expiry',
    cvv = 'cvv',
  }
}

export const Locale = {
  en: 'en',
  fr: 'fr',
  es: 'es',
  pt: 'pt',
  it: 'it',
  de: 'de',
} as const;

export type Locale = (typeof Locale)[keyof typeof Locale];

export enum Currency {}

export namespace Razorpay {
  export type Error = {
    status?: string;
    errorCode?: string;
    message?: string;
    errorType?: string;
  };
}
