import {debugMode} from '@/constants/environment';
import t from '@/hosted_fields/common/locale';
import {Locale, ValidationErrorMessage} from '@/hosted_fields/common/types';
import {jsonify} from '@/utils/utility-functions';
import {intentError} from '@/utils/utility-functions';

// Error and Warning codes
const ErrorCodes = {
  unknownError: 'error.unknownError',
  recaptchaMaxRetryOver: 'error.recaptchaMaxRetryOver',
  captchaGenerateTokenMaxRetryOver: 'error.captchaGenerateTokenMaxRetryOver',
  captchaInitializationMaxRetryOver: 'error.captchaInitializationMaxRetryOver',
  recaptchaScriptLoadFailed: 'error.recaptchaScriptLoadFailed',
  recaptchaLoadTimeout: 'error.recaptchaLoadTimeout',
  recaptchaInitiationTimeout: 'error.recaptchaInitiationTimeout',
  missingMandatoryParameters: 'error.host.missingMandatoryParameters',

  // FIELD ERRORS
  invalidFieldType: 'error.field.invalidFieldType',
  fieldAlreadyExists: 'error.field.fieldAlreadyExists',
  fieldNotAllowed: 'error.field.fieldNotAllowed',
  noFieldsToMount: 'error.field.noFieldsToMount',
  missingFields: 'error.field.missingFields',

  // Component Errors
  moduleNotSupported: 'error.component.moduleNotSupported',
  moduleNotLoaded: 'error.component.moduleNotLoaded',
  invalidComponentType: 'error.component.invalidComponentType',
  invalidSelector: 'error.component.invalidSelector',
  noContainerElement: 'error.component.noContainerElement',
  containerElementNotFound: 'error.component.containerElementNotFound',
  componentNotRegistered: 'error.component.componentNotRegistered',
  componentNotFound: 'error.component.componentNotFound',
  invalidListener: 'error.component.invalidListener',
  frameNotSpecified: 'error.component.frameNotSpecified',
  validationFailed: 'error.component.validationFailed',

  // Master Errors
  componentAlreadyPresent: 'error.master.componentAlreadyPresent',
  errorMountingMaster: 'error.master.errorMountingMaster',
  instanceAlreadyExists: 'error.master.instanceAlreadyExists',
  unknownMessageOrigin: 'error.master.unknownMessageOrigin',
  sendMessageError: 'error.master.sendMessageError',
  sendMessageMismatchError: 'error.master.sendMessageMismatchError',
  noMessageTarget: 'error.master.noMessageTarget',
  receiveMessageError: 'error.master.receiveMessageError',
  responseError: 'error.master.responseError',
  responseMismatchError: 'error.master.responseMismatchError',
  replyTimeout: 'error.master.replyTimeout',
  missingPublishableKey: 'error.options.missingPublishableKey',
  masterNotMountedForComponents: 'error.master.masterNotMountedForComponents',

  // Validation Errors
  cardNumberInvalid: 'error.validation.cardNumberInvalid',
  cardNumberIncomplete: 'error.validation.cardNumberIncomplete',
  invalidCard: 'error.validation.invalidCard',

  cardExpiryPast: 'error.validation.cardExpiryPast',
  cardExpiryInvalid: 'error.validation.cardExpiryInvalid',
  cardExpiryIncomplete: 'error.validation.cardExpiryIncomplete',

  cardCvvIncomplete: 'error.validation.cardCvvIncomplete',
  cardCvvInvalid: 'error.validation.cardCvvInvalid',

  invalidAriaLabel: 'error.validation.ariaLabel',
  cardCommonDeclineReason: 'error.validation.cardCommonDeclineReason',

  // Warnings
  // Component
  componentNotMounted: 'warning.component.componentNotMounted',
  componentMounting: 'warning.component.componentMounting',
  componentAlreadyMounted: 'warning.component.componentAlreadyMounted',

  // CSS Style warnings
  unknownProperty: 'warning.css.unknownProperty',
  invalidValueProvided: 'warning.css.invalidValueProvided',
  unknownFieldProperty: 'warning.css.unknownFieldProperty',
  unknownCssProperty: 'warning.css.unknownCssProperty',
  unknownCssClass: 'warning.css.unknownCssClass',
  incorrectClass: 'warning.css.incorrectClass',
  unknownFontProp: 'warning.css.unknownFontProp',
  invalidFont: 'warning.css.invalidFont',
  invalidSrcUrl: 'warning.css.invalidSrcUrl',
  fontUrlNotWhitelisted: 'warning.css.fontUrlNotWhitelisted',
  fontNotInPx: 'warning.css.fontNotInPx',
  invalidCssValue: 'warning.css.invalidCssValue',
  invalidCssColor: 'warning.css.invalidCssColor',

  localeNotSupported: 'warning.options.localeNotSupported',
  invalidFields: 'warning.options.invalidFields',
  invalidPlaceholder: 'warning.options.invalidPlaceholder',
  invalidPlaceholderValue: 'warning.options.invalidPlaceholderValue',
  unknownStyleProperty: 'warning.options.unknownStyleProperty',
  invalidStyles: 'warning.options.invalidStyles',

  /** THREE-D-SECURE ERRORS */
  invalidPaymentIntent: 'error.threedsecure.invalidPaymentIntent',
  missingCardDetails: 'error.threedsecure.missingCardDetails',
  invalidCardReferenceId: 'error.threedsecure.invalidCardReferenceId',
  unknownPaymentAttemptStatus: 'error.threedsecure.unknownPaymentAttemptStatus',

  invalidAdyenCheckoutInstance: 'error.threedsecure.adyen.invalidAdyenCheckoutInstance',
  missingAdyenPaymentInfo: 'error.threedsecure.adyen.missingPaymentInfo',
  missingAdyenRedirectInfo: 'error.threedsecure.adyen.missingRedirectInfo',
  invalidAdyenOriginKey: 'error.threedsecure.adyen.invalidOriginKey',

  missingBraintreePaymentInfo: 'error.threedsecure.braintree.missingPaymentInfo',
  invalidBraintreeInstance: 'error.threedsecure.braintree.invalidInstance',
  missingBraintreeInstance: 'error.threedsecure.braintree.missingInstance',
  missingBraintree3DSecureInstance: 'error.threedsecure.braintree.missingThreedsecure',
  invalidBraintreeHostedFields: 'error.threedsecure.braintree.invalidHostedFields',
  invalidBraintreeTokenizedCard: 'error.threedsecure.braintree.invalidTokenizedCard',
  noBraintreeTokenizedCard: 'error.threedsecure.braintree.noTokenizedCards',
  missingNonceForBraintreeReferenceId: 'error.threedsecure.braintree.missingNonceForBraintreeReferenceId',
  failedBraintreeThreeDSecureAuth: 'error.threedsecure.braintree.failedThreeDSecureAuth',

  scriptLoadError: 'error.scriptError',
  missingSpreedlyPaymentInfo: 'error.threedsecure.spreedly.missingPaymentInfo',
  missingBluesnapPaymentInfo: 'error.threedsecure.bluesnap.missingPaymentInfo',
  invalidStripeInstance: 'error.threedsecure.stripe.invalidInstance',
  missingStripePaymentInfo: 'error.threedsecure.stripe.missingPaymentInfo',
  missingStripeInstance: 'error.threedsecure.stripe.missingInstance',
  missingEbanxPaymentInfo: 'error.threedsecure.ebanx.missingPaymentInfo',
  invalidEbanxDocument: 'error.threedsecure.ebanx.invalidDocument',
  missingGlobalPaymentInfo: 'error.threedsecure.globalPayments.missingPaymentInfo',
  missingDlocalPaymentInfo: 'error.threedsecure.dlocal.missingPaymentInfo',
  invalidDlocalDocument: 'error.threedsecure.dlocal.invalidDocument',
  missingPayfurlCountryCode: 'error.threedsecure.payfurl.missingCountryCode',
  missingChargebeePaymentsPaymentInfo: 'error.threedsecure.chargebeePayments.missingPaymentInfo',
  invalidChargebeePaymentCheckoutInstance:
    'error.threedsecure.chargebeePayments.invalidChargebeePaymentsCheckoutInstance',
  missingVantivPaymentInfo: 'error.threedsecure.vantivPayments.missingPaymentInfo',

  // IDeal Errors
  missingIDealCurrency: 'error.payments.iDeal.missingCurrency',
  missingIDealIssuerBank: 'error.payments.iDeal.missingIssuerBank',

  missingPaymentIntentForMountButton: 'error.payaments.common.missingPaymentIntentForMountButton',
  popupBlocked: 'error.payments.common.popupBlocked',
  popupConsentDismissed: 'error.payments.common.popupConsentDismissed',
  missingTokenInfoInPaymentData: 'error.payaments.gpay.missingTokenInfoInPaymentData',

  missingDotpayCurrency: 'error.payments.dotpay.missingCurrency',
  missingDotpayIssuerBank: 'error.payments.dotpay.missingIssuerBank',

  missingIngenicoDirectPaymentInfo: 'error.threedsecure.ingenico_direct.missingPaymentInfo',

  missingWorldPayPaymentInfo: 'error.threedsecure.worldpay.missingPaymentInfo',
  missingWorldPayEmailInfo: 'error.threedsecure.worldpay.missingEmailInfo',
  missingWorldPayCardHolderInfo: 'error.threedsecure.worldpay.missingCardHolderInfo',

  // Mollie Errors
  missingMolliePaymentInfo: 'error.threedsecure.mollie.missingPaymentInfo',
  missingMollieCardHolderInfo: 'error.threedsecure.mollie.missingCardHolderInfo',
  // Vat Validation Errors
  missingVatParams: 'error.functions.vat.missingVatParams',

  // apple pay not available error
  applePayNotSupported: 'error.payments.applepay.applePayNotSupported',
  applePayPaymentsNotAvailable: 'error.payments.applepay.applePayPaymentsNotAvailable',
  applePayElementNotFound: 'error.payments.applepay.applePayElementNotFound',

  // Razorpay Errors
  missingRazorPayPaymentInfo: 'error.threedsecure.razorpay.missingPaymentInfo',
  missingRazorPayEmailInfo: 'error.threedsecure.razorpay.missingEmailInfo',
  missingRazorPayPhoneInfo: 'error.threedsecure.razorpay.missingPhoneInfo',
  missingRazorPayCardHolderInfo: 'error.threedsecure.razorpay.missingCardHolderInfo',

  //Direct Debit Errors
  unsupportedDirectDebitScheme: 'error.payments.directDebit.unsupportedScheme',
  unsupportedDirectDebitGateway: 'error.payments.directDebit.unsupportedGateway',
  missingDirectDebitPaymentInfo: 'error.payments.directDebit.missingPaymentInfo',
  invalidOrMissingDirectDebitPaymentInfo: 'error.payments.directDebit.invalidOrMissingPaymentInfo',
  plaidNotsupported: 'error.payments.directDebit.plaidNotsupported',

  //Direct Debit Error
  missingBancontactAdyenPaymentInfo: 'error.payments.bancontact.adyen.missingPaymentInfo',

  //Klarna Pay Now Error
  missingKlarnaPayNowBillingAddressInfo: 'error.payments.klarnaPayNow.adyen.missingBillingAddressInfo',

  // Bank of Amercia errors
  missingBankOfAmericaPaymentInfo: 'error.threedsecure.bankOfAmerica.missingPaymentInfo',
  missingBankOfAmericaEmailInfo: 'error.threedsecure.bankOfAmerica.missingEmailInfo',

  // Boleto Error
  missingBoletoPaymentInfo: 'error.payments.boleto.missingPaymentInfo',
  invalidOrMissingBoletoPaymentInfo: 'error.payments.boleto.invalidOrMissingPaymentInfo',

  // Payfurl errors
  missingPayfurlPaymentInfo: 'error.threedsecure.payfurl.missingPaymentInfo',

  //Venmo Error
  venmoNotSupportedByBrowser: 'error.payments.venmo.venmoNotSupportedByBrowser',
  venmoAppCanceled: 'error.payments.venmo.venmoAppCanceled',
  venmoCanceled: 'error.payments.venmo.error.venmoCanceled',
  invalidOrMissingFasterPymtsPaymentInfo: 'error.payments.fasterPayment.invalidOrMissingPaymentInfo',
  missingFasterPymtsCountryCode: 'error.payments.fasterPayment.missingCountryCode',
  eitherCurrencyOrGwAccIdRequiredForFasterPymts: 'error.payments.fasterPayment.eitherCurrencyCodeOrGwAccIdRequired',

  invalidOrMissingPayToPaymentInfo: 'error.payments.payTo.invalidOrMissingPaymentInfo',
  missingPayToCountryCode: 'error.payments.payTo.missingCountryCode',
  eitherCurrencyOrGwAccIdRequiredForPayTo: 'error.payments.payTo.eitherCurrencyCodeOrGwAccIdRequired',

  invalidOrMissingSepaInstantTransferPaymentInfo: 'error.payments.sepaInstantTransfer.invalidOrMissingPaymentInfo',
  missingSepaInstantTransferCountryCode: 'error.payments.sepaInstantTransfer.missingCountryCode',
  eitherCurrencyOrGwAccIdRequiredForSepaInstantTransfer:
    'error.payments.sepaInstantTransfer.eitherCurrencyCodeOrGwAccIdRequired',

  // Paycom errors
  missingPayComPaymentInfo: 'error.threedsecure.paycom.missingPaymentInfo',
  invalidOrMissingPayComCardPaymentInfo: 'error.threedsecure.paycom.invalidOrMissingPaymentInfo',

  /**
   * Component Errors
   */
  invalidComponent: 'error.components.invalidComponent',

  // 3ds handle error
  missingPayPaymentInfo: 'error.threedsecure.worldpay.missingPaymentInfo',
  missingCardHolderInfo: 'error.threedsecure.worldpay.missingCardHolderInfo',
};

function getStdErrorCodes(): Array<string> {
  return Object.keys(ErrorCodes).map((key) => ErrorCodes[key]);
}

function isStdErrorCode(code: string): boolean {
  const errorCodes = getStdErrorCodes();
  if (code && typeof code === 'string') {
    return !!~errorCodes.indexOf(code);
  }
  return false;
}

export enum ErrorType {
  ApiError = 'ApiError',
  ClientError = 'ClientError',
  GatewayError = 'GatewayError',
}

export type ErrorObject = {
  name?: string;
  message?: string;
  code?: string;
  type?: ErrorType;
  stack?: string;
  data?: any;
  detail?: any;
};

export const DefaultError: ErrorObject = {
  name: camelToSnakeCase('ChargebeeClientError'),
  code: 'ChargebeeClientError',
  message: 'Something went wrong!',
  type: ErrorType.ClientError,
};

function hasErrorCauseId(data: CbError): data is CbError {
  return (
    data &&
    typeof data.detail === 'object' &&
    data.detail !== null &&
    typeof (data.detail as any).error_cause_id === 'string'
  );
}

function formatError(errInstance: CbError, err: any, data?: any, locale?): void {
  if (err.response) {
    // If it includes an API Response
    setAPIErrorObj(errInstance, err);
  } else if (err instanceof Error) {
    const errData: any = jsonify(err);
    setErrorObj(errInstance, errData);
  } else if (err.payment_intent && err.payment_intent.active_payment_attempt) {
    const errData = intentError(err.payment_intent);
    setErrorObj(errInstance, errData);
  } else {
    switch (typeof err) {
      case 'string': {
        if (isStdErrorCode(err)) {
          // Standard predefined error codes
          setStandardError(errInstance, err, data, locale);
        } else {
          // Text error messages
          setStringError(errInstance, err);
        }
        break;
      }

      case 'object': {
        setErrorObj(errInstance, err); // Error object
        break;
      }

      case 'undefined':
      default: {
        setDefaultError(errInstance); // Default Error message
      }
    }
  }
}

function getErrorFromApiResponse(errorResponse: any): any {
  // API Response error format is different for different APIs
  // Some APIs have errors array and some have only one error with a message
  const errData = errorResponse.data;
  let error: any;
  if (errData) {
    if (errData.errors && errData.errors.constructor === Array && errData.errors.length) {
      error = errData.errors[0];
      error.raw = errData.errors;
    } else if (errData.error) error = errData.error;
    else if (errData.api_error_code || errData.error_code) error = errData;
  }
  return error;
}

export function defaultError() {
  return new CbError({
    name: DefaultError.name,
    message: DefaultError.message,
  });
}

function setAPIErrorObj(errInstance: CbError, result: any) {
  const apiResponse = result.response;
  const errorObj = getErrorFromApiResponse(apiResponse);

  if (!errorObj) {
    errInstance.name = DefaultError.name;
    errInstance.message = DefaultError.message;
    return;
  }

  if (errorObj.raw) errInstance.data = errorObj.raw;

  if (apiResponse.status == 401) {
    errInstance.name = 'unauthorized';
    errInstance.message = errorObj.message;
    return;
  }

  errInstance.name = errorObj.api_error_code || errorObj.error_code || DefaultError.name;
  errInstance.message = errorObj.error_msg || errorObj.error_text || errorObj.message || DefaultError.message;
}

function setStandardError(errInstance: CbError, code: string, data?: any, locale?) {
  errInstance.message = t(code, data, locale);
  errInstance.code = code.split('.').pop();
  errInstance.name = camelToSnakeCase(errInstance.code);
  errInstance.type = DefaultError.type;
}

function setStringError(errInstance: CbError, message: string) {
  errInstance.code = 'ChargebeeClientError';
  errInstance.name = camelToSnakeCase(errInstance.code);
  errInstance.message = message;
  errInstance.type = DefaultError.type;
}

function setErrorObj(errInstance: CbError, err: ErrorObject) {
  errInstance.code = (err && err.code) || DefaultError.code;
  errInstance.name = (err && (err.name || err.code)) || DefaultError.name;
  errInstance.type = (err && err.type) || DefaultError.type;
  errInstance.stack = (err && err.stack) || undefined;
  errInstance.message = (err && err.message) || DefaultError.message;
  errInstance.detail = (err && err.detail) || {};
}

function setDefaultError(errInstance: CbError) {
  setErrorObj(errInstance, DefaultError);
}

/*
  Common Error Handler Class
  Note: Methods cannot be added to class extending the native Error
  only additional properties can be added
*/
export class CbError extends Error {
  message: string;
  name: string;
  stack: string;
  data: any;
  type: ErrorType;
  code: string;
  detail: string;

  constructor(err?: any, data?: any, locale?, ...args) {
    super(...args);
    if (debugMode()) {
      console.log(-1, 'Error arguments', err, data, locale, args);
      console.trace();
    }

    try {
      // @ts-ignore
      if (Error.captureStackTrace) {
        // @ts-ignore
        Error.captureStackTrace(this, CbError);
      }
    } catch (e) {}
    if (hasErrorCauseId(data)) {
      formatError(this, data, data, locale);
    } else formatError(this, err, data, locale);
    if (data) this.data = data;
  }
}

// cameCase to snake_case
function camelToSnakeCase(str: string, upperCase: boolean = true): string {
  str = str || '';
  if (typeof str == 'string') {
    str = str
      .split(/(?=[A-Z])/)
      .join('_')
      .toUpperCase();
    str = upperCase ? str.toUpperCase() : str.toLowerCase();
  }
  return str;
}

export const Warn = (err: string, data?, locale?: Locale) => {
  let message = isStdErrorCode(err) ? t(err, data, locale) : err;
  message = `WARNING: ${message}`;
  console.warn(message);
};

export const ValidationError = (code: string, locale: Locale): ValidationErrorMessage => {
  if (!code) return undefined;
  const message = t(code, null, locale);
  const errorCode = code.split('.').pop();
  const formattedErrorCode = camelToSnakeCase(errorCode, false);
  return {
    errorCode: formattedErrorCode,
    message,
  };
};

export default ErrorCodes;
