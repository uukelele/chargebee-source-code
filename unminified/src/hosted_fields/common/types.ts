import {Braintree} from '@/extensions/three_domain_secure/handlers/braintree/types';
import {ComponentType} from '@/hosted_fields/common/base-types';
import {
  Events,
  Field,
  HostedFields,
  Locale as L,
  Child,
  Host,
  Master,
  Card,
  IDeal,
  EventKeys,
  CardIconPosition,
} from '@/hosted_fields/common/enums';
import {PaymentMethodType} from '@/internal/payment-intent/types';
import {Metadata} from '@/plugins/logger/types';

export interface CommunicationMessage {
  message: ActionInnerMessage | ResponseInnerMessage;
  error?: ActionInnerMessage | ResponseInnerMessage;
  replyId: string;
  srcWindowName?: string;
  cbEvent: boolean;
  targetWindowName: string;
}

export interface ActionInnerMessage {
  action: Master.Actions | Child.Actions | Host.Actions;
  data?: any;
  options?: {
    noReply?: boolean;
  };
}

export interface ResponseInnerMessage {}

export type CbToken = {
  token: string;
  vaultToken?: string;
  additional_information?: TokenizationResponseAdditionalInfo;
};

// Allowed Event listeners on Field
export const AllowedListeners = [Events.focus, Events.blur, Events.change, Events.ready, Events.keyPress];

export const AllowedCardIcons = [
  'amex',
  'dinersclub',
  'discover',
  'jcb',
  'mastercard',
  'unionpay',
  'visaelectron',
  'visa',
  'argencard',
  'cabal',
  'carnet',
  'cencosud',
  'cmrfalabella',
  'elo',
  'hipercard',
  'maestro',
  'rupay',
  'tarjetanaranja',
  'nativa',
  'cartes_bancaires',
  'mada',
];

export const AllowedKeyPressEvents = [EventKeys.escape];

// export type FontURL = string;

// export type FontFace = {
//   fontFamily: string;
//   src?: string;
//   fontStyle?: string;
//   fontWeight?: string
// };

export type Error = {
  name: string;
  message: string;
};

export type ValidationErrorMessage = {
  errorCode: string;
  message: string;
};

export type InitOptions = {
  site: string;
  publishableKey: string;
};

export type FieldComponentOptions = {
  field?: FieldOptions;
  component?: ComponentOptions;
  cardIconPosition?: CardIconPosition;
};

export type ComponentOptions = {
  [HostedFields.Options.currency]?: string;
  [HostedFields.Options.classes]?: Classes;
  [HostedFields.Options.style]?: Styles;
  [HostedFields.Options.fonts]?: Fonts;
  [HostedFields.Options.field]?: Fields;
  [HostedFields.Options.locale]?: Locale;
  [HostedFields.Options.placeholder]?: Placeholder;
  [HostedFields.Options.ariaLabel]?: AriaLabel;
  icon?: boolean;
  translations?: Translations;
  showTestCards?: boolean;
};

export type FieldOptions = {
  [HostedFields.Options.style]?: Styles;
  [HostedFields.Options.placeholder]?: string;
  [HostedFields.Options.ariaLabel]?: string;
};

export type Classes = {
  [HostedFields.CSSClass.focus]?: string;
  [HostedFields.CSSClass.empty]?: string;
  [HostedFields.CSSClass.invalid]?: string;
  [HostedFields.CSSClass.complete]?: string;
};

export type FieldConfiguration = {
  [HostedFields.FieldOption.required]?: boolean;
  [HostedFields.FieldOption.show]?: boolean;
};

let defaultFieldConfiguration: FieldConfiguration = {
  [HostedFields.FieldOption.required]: true,
  [HostedFields.FieldOption.show]: true,
};
export default defaultFieldConfiguration;

export type Fields = {
  [HostedFields.Field.cvv]?: FieldConfiguration;
};

export type StyleBlock = CSSStyleBlock & PseudoStyleBlock;

export type Styles = {
  [HostedFields.StyleSections.base]?: StyleBlock;
  [HostedFields.StyleSections.empty]?: StyleBlock;
  [HostedFields.StyleSections.invalid]?: StyleBlock;
};

export type Fonts = FontFace[];

export type FontFace = {
  fontFamily: string;
  src?: string;
  fontStyle?: string;
  fontWeight?: string;
};

export type FontURL = string;

export type Locale = L;

export type Placeholder = {
  [HostedFields.Placeholder.number]?: string;
  [HostedFields.Placeholder.expiry]?: string;
  [HostedFields.Placeholder.cvv]?: string;
  [HostedFields.Options.ariaLabel]?: AriaLabel;
};

export type CSSStyleBlock = {
  [HostedFields.CustomCSSProperty.iconColor]?: string;

  [HostedFields.StdCSSProperty.color]?: string;
  [HostedFields.StdCSSProperty.background]?: string;
  [HostedFields.StdCSSProperty.backgroundColor]?: string;
  [HostedFields.StdCSSProperty.letterSpacing]?: string;

  [HostedFields.StdCSSProperty.textAlign]?: string;
  [HostedFields.StdCSSProperty.textTransform]?: string;
  [HostedFields.StdCSSProperty.textDecoration]?: string;
  [HostedFields.StdCSSProperty.textShadow]?: string;

  [HostedFields.StdCSSProperty.lineHeight]?: string;

  [HostedFields.StdCSSProperty.webkitTextColor]?: string;

  [HostedFields.FontProperty.src]?: string;
  [HostedFields.FontProperty.fontFamily]?: string;
  [HostedFields.FontProperty.fontSize]?: string;
  [HostedFields.FontProperty.fontSmoothing]?: string;
  [HostedFields.FontProperty.fontStyle]?: string;
  [HostedFields.FontProperty.fontWeight]?: string;
  [HostedFields.FontProperty.fontVariant]?: string;
};

export type PseudoStyleBlock = {
  [HostedFields.PseudoCSSProperty.hover]?: CSSStyleBlock;
  [HostedFields.PseudoCSSProperty.focus]?: CSSStyleBlock;
  [HostedFields.PseudoCSSProperty.disabled]?: CSSStyleBlock;
  [HostedFields.PseudoCSSProperty.placeholder]?: CSSStyleBlock;
  [HostedFields.PseudoCSSProperty.selection]?: CSSStyleBlock;
  [HostedFields.PseudoCSSProperty.autofill]?: CSSStyleBlock;
  [HostedFields.PseudoCSSProperty.focusPlaceholder]?: CSSStyleBlock;
};

export type AriaLabel = {
  [HostedFields.AriaLabel.number]?: string;
  [HostedFields.AriaLabel.expiry]?: string;
  [HostedFields.AriaLabel.cvv]?: string;
};

export type InputFieldOptions = {
  mxw: string;
  name: Field;
  autocomplete: string;
  maxlength: number;
  placeholder: string;
  describedby: string;
  fieldDesc: string;
  ariaLabel: string;
};

export type MessageData = {
  componentName?: string;
  type?: ComponentType;
  baseOptions?: ComponentOptions;
  fonts?: FontFace[];
  name?: string;
  fieldType?: Card.ComponentFieldType | IDeal.ComponentFieldType;
  frame?: string;
  options?: FieldOptions;
  metadata?: Metadata;
};

export type FontsWhitelist = {
  fonts: FontFace[];
  whitelist: string[];
};

export type FieldValue = {
  [id: string]: FieldStatus & {value?: string};
};

export type FieldStatus = ValidationStatus & {
  forceValidation?: boolean;
  isFocused?: boolean;
  value?: string;
};

export type ValidationStatus = {
  isComplete?: boolean;
  isEmpty?: boolean;
  isValid?: boolean;
  isInvalid?: boolean;
  cardType?: any;
  binData?: BINData;
  error?: string;
};

export type ComponentMeta = {
  name: string;
  type: ComponentType;
  frames: Array<string>;
  options?: ComponentOptions;
  data?: any;
};

export type BroadcastStatus = any;

export type _FieldChangeEvent = {
  type: Events;
  key?: EventKeys;
  complete: boolean;
  error: ValidationErrorMessage;
  empty: boolean;
};

export interface BINData {
  bin?: string;
  last4?: string;
  brand?: string;
  isPrepaid?: boolean;
  cardType?: string;
  countryName?: string;
  verificationInfo?: {
    rule_id: string;
    verification_control: string;
  };
}

export type FieldChangeEvent = _FieldChangeEvent & {
  field: Card.ComponentFieldType;
  cardType: string;
  binData?: BINData;
};

export type IDealFieldChangeEvent = _FieldChangeEvent & {
  field: IDeal.ComponentFieldType;
  value: any;
};

export type EventMessage = {
  event: Events;
  key: EventKeys;
  frame: string;
  status?: {
    [Card.ComponentFieldType.Number]?: FieldStatus;
    [Card.ComponentFieldType.Expiry]?: FieldStatus;
    [Card.ComponentFieldType.CVV]?: FieldStatus;
  };
  data?: any;
};

export type ReplyMessageOptions = {
  timeout?: number;
  action?: string;
};

export type CbTokenResponse = {
  token: {
    created_at: number;
    gateway: string;
    gateway_account_id: string;
    id: string;
    id_at_vault: string;
    ip_address: string;
    object: string; // Object type 'token'
    payment_method_type: string;
    status: string;
    vault: string; // Vault name
  };
};

export type Translations = {
  [LanguageCode: string]: {
    [key: string]: string;
  };
};

export type tokenizationResponse = {
  pm_list: Array<object>;
};

export type gatewayAdditionalInfo = {
  kount_merchant_id?: string;
};

export interface StateFullPromise<T> extends Promise<T> {
  isResolved: () => boolean;
  isFulfilled: () => boolean;
  isPending: () => boolean;
  isRejected: () => boolean;
}

export type TestCard = {
  number: string;
  cvv: string;
  name: string;
  exp_month: string;
  exp_year: string;
  desc?: string;
};

export type TestCardStyleBlock = {
  border?: string;
  borderRadius?: string;
  height?: string;
};

export type CbTokenizationAPIInput = {
  gateway_account_id: string;
  payment_method_type: PaymentMethodType;
  id_at_vault: string;
  gw_obj_type: 'token';
  additional_information?: string; // DB Col Type for cb_token.additional_data is string
};

export type GwTokenizationResponse = {
  token: string;
  Orchestrator?: string;
  deviceData: {
    braintree?: Braintree.FraudData;
  };
  additional_information: TokenizationResponseAdditionalInfo;
};

export type TokenizationResponseAdditionalInfo = {
  braintree?: Braintree.TokenizationAdditionalInfo;
};

export interface BinDataResponse {
  card_bin_info: Array<{
    brand: string;
    isPrepaid: boolean;
    cardType: string;
    countryName: string;
  }>;
  verification_info: {
    rule_id: string;
    verification_control: string;
    verification_control_outcome: Record<string, any>;
    verification_outcome_translation_key: string;
  };
}
