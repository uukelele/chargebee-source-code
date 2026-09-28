import {
  AddressContact,
  ApplePayShippingMethodUpdate,
  ApplePayShippingContactUpdate,
  ApplePayPaymentMethodUpdate,
} from './types';
import EnvConstants from '@/constants/environment';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {loadScriptUsingPredicate} from '@/internal/common/utils';

export function transformAddress(address: AddressContact): any {
  let _address = {}; // Base value

  if (address) {
    _address = {
      firstName: address.givenName,
      lastName: address.familyName,
      addressLine1: address.addressLines && address.addressLines[0],
      addressLine2: address.addressLines && (address.addressLines[1] || ''),
      zip: address.postalCode,
      stateCode: address.administrativeArea,
      city: address.locality,
      countryCode: address.countryCode,
      country: address.country,
      email: address.emailAddress,
    };
  }
  return _address;
}

export function mountApplePayButton(containerEl: HTMLElement, mountOptions, startSession: Function): Promise<boolean> {
  if (containerEl) {
    // Setup button styling
    const applePayCssEl: HTMLLinkElement = document.createElement('link');
    applePayCssEl.rel = 'stylesheet';
    // @ts-ignore
    applePayCssEl.href = `${EnvConstants.ASSET_PATH}/assets/css/apple-pay.min.css`;
    document.head.appendChild(applePayCssEl);
    const buttonColor = mountOptions.buttonColor || 'black';

    // Check if browser supports native Apple Pay button styling (Safari)
    const supportsNativeButton =
      typeof CSS !== 'undefined' && CSS.supports && CSS.supports('-webkit-appearance', '-apple-pay-button');

    if (supportsNativeButton) {
      // Safari - use native Apple Pay button styling
      containerEl.classList.add('apple-pay-button', `apple-pay-button-${buttonColor}`);

      if (mountOptions.buttonType) {
        containerEl.setAttribute('style', `-apple-pay-button-type: ${mountOptions.buttonType};`);
      }
      if (mountOptions.locale) {
        containerEl.setAttribute('lang', mountOptions.locale);
      }

      // Attach onclick Listener
      containerEl.addEventListener('click', (e) => startSession());
    } else {
      // Non-Safari browsers - use custom apple-pay-button element
      const applePayButtonEl: HTMLElement = document.createElement('apple-pay-button');
      applePayButtonEl.setAttribute('buttonstyle', buttonColor);
      if (mountOptions.buttonType) {
        applePayButtonEl.setAttribute('type', mountOptions.buttonType);
      }
      if (mountOptions.locale) {
        applePayButtonEl.setAttribute('locale', mountOptions.locale);
      }
      applePayButtonEl.style.setProperty('--apple-pay-button-width', '100%');
      applePayButtonEl.style.setProperty('--apple-pay-button-height', '40px');
      applePayButtonEl.style.setProperty('--apple-pay-button-border-radius', '8px');
      applePayButtonEl.style.setProperty('--apple-pay-button-padding', '0');
      applePayButtonEl.style.setProperty('--apple-pay-button-box-sizing', 'border-box');
      containerEl.appendChild(applePayButtonEl);
      applePayButtonEl.addEventListener('click', (e) => startSession());
      containerEl.addEventListener('click', (e) => startSession());
    }

    return Promise.resolve(true);
  }
  return Promise.reject(new CbError(Errors.applePayElementNotFound));
}

export function addFieldsToPaymentRequest(options, requestData): PaymentRequest {
  const requiredBillingContactFields = [];
  const requiredShippingContactFields = [];
  if (options.requestPayerEmail) {
    requiredBillingContactFields.push('email');
    requiredShippingContactFields.push('email');
  }
  if (options.requestPayerName) {
    requiredBillingContactFields.push('name');
    requiredShippingContactFields.push('name');
  }
  if (options.requestPayerPhone) {
    requiredBillingContactFields.push('phone');
    requiredShippingContactFields.push('phone');
  }
  if (options.requestShipping) {
    requiredShippingContactFields.push('postalAddress');
  }
  if (options.requestBilling) {
    requiredBillingContactFields.push('postalAddress');
  }

  const paymentRequestData: any = {
    requiredBillingContactFields: requiredBillingContactFields,
    ...requestData,
  };
  if (options.requestShipping) {
    paymentRequestData.requiredShippingContactFields = requiredShippingContactFields;
    if (options.shippingOptions) {
      paymentRequestData.shippingOptions = options.shippingOptions;
    }
    if (options.shippingMethods) {
      paymentRequestData.shippingMethods = options.shippingMethods;
    }
    if (options.shippingType) {
      paymentRequestData.shippingType = options.shippingType;
    }
  }
  if (options.lineItems) {
    paymentRequestData.lineItems = options.lineItems;
  }
  if (options.displayItems) {
    paymentRequestData.lineItems = options.displayItems;
  }

  if (options.recurringPaymentRequest) {
    paymentRequestData.recurringPaymentRequest = buildPaymentRequest(options.recurringPaymentRequest);
  }
  return paymentRequestData;
}

export function buildPaymentRequest(recurringPaymentRequest: any): any {
  if (!recurringPaymentRequest) return undefined;

  const {paymentDescription, regularBilling, trialBilling, billingAgreement, managementURL, tokenNotificationURL} =
    recurringPaymentRequest;

  const paymentRequest: any = {};

  if (paymentDescription) {
    paymentRequest.paymentDescription = paymentDescription;
  }

  if (regularBilling) {
    paymentRequest.regularBilling = regularBilling;
  }

  if (trialBilling) {
    paymentRequest.trialBilling = trialBilling;
  }

  if (billingAgreement) {
    paymentRequest.billingAgreement = billingAgreement;
  }

  if (managementURL) {
    paymentRequest.managementURL = managementURL;
  }

  if (tokenNotificationURL) {
    paymentRequest.tokenNotificationURL = tokenNotificationURL;
  }

  return paymentRequest;
}

export function attachEventListener(session, gatewayHandler): void {
  const mountOptions = gatewayHandler.mountOptions;
  const handleValidationErr = (validationErr) => {
    session.abort();
    gatewayHandler.callbackHandler.triggerErrorCallback(new CbError(validationErr));
  };

  if (mountOptions.onshippingmethodselected) {
    session.onshippingmethodselected = (event) => {
      const callback = (update: ApplePayShippingMethodUpdate) => {
        try {
          session.completeShippingMethodSelection(update);
        } catch (validationErr) {
          handleValidationErr(validationErr);
        }
      };
      mountOptions.onshippingmethodselected(event, callback);
    };
  }

  if (mountOptions.onshippingcontactselected) {
    session.onshippingcontactselected = (event) => {
      const callback = (update: ApplePayShippingContactUpdate) => {
        try {
          session.completeShippingContactSelection(update);
        } catch (validationErr) {
          handleValidationErr(validationErr);
        }
      };
      mountOptions.onshippingcontactselected(event, callback);
    };
  }

  if (mountOptions.onpaymentmethodselected) {
    session.onpaymentmethodselected = (event) => {
      const callback = (update: ApplePayPaymentMethodUpdate) => {
        try {
          session.completePaymentMethodSelection(update);
        } catch (validationErr) {
          handleValidationErr(validationErr);
        }
      };
      mountOptions.onpaymentmethodselected(event, callback);
    };
  }
}

export function loadApplePaySdk(): Promise<Boolean> {
  return loadScriptUsingPredicate(
    `https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js`,
    () => typeof window.PaymentRequest !== 'undefined' && typeof window.ApplePaySession !== 'undefined'
  );
}
