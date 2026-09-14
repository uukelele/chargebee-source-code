import {
  CardInfo,
  Address,
  Customer,
  PaymentIntent,
  ConfirmApiPayload,
  ConfirmApiInputPayload,
} from '@/internal/payment-intent/types';

import {BUSINESS_ENTITY_HEADER, BRAND_ID_HEADER} from '@/plugins/core/api/interface';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {StateFullPromise} from '@/hosted_fields/common/types';
import Helpers from '@/helpers';
import sanitizeError from '@/internal/common/error-sanitizer';
import Logger from '@/utils/logger_old';
import {isObjectEmpty} from '@/utils/utility-functions';

declare global {
  interface Window {
    _hp_csp_nonce: string;
  }
}

export const loadScript = (url, namespace): Promise<boolean> => {
  return loadScriptUsingPredicate(
    url,
    () => {
      return !!window[namespace];
    },
    namespace
  );
};

export const loadScriptUsingPredicate = (url, predicate, namespace?): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (predicate() == true) {
      resolve(true);
    } else {
      let timeout = window.setTimeout(() => reject(Errors.scriptLoadError), 50000);
      const onload = () => {
        if (predicate() == true) {
          clearTimeout(timeout);
          window.setTimeout(() => resolve(true), 100);
        } else {
          window.setTimeout(onload, 100);
        }
      };
      const onerror = () => {
        reject(Errors.scriptLoadError);
      };
      loadScriptWithoutPredicate(url, onload, onerror, namespace);
    }
  });
};

export const loadScriptWithoutPredicate = (url, onload, onerror?, namespace?) => {
  var newScript = document.createElement('script');
  newScript.onload = onload;
  newScript.onerror = onerror;
  let nonce = window._hp_csp_nonce;
  if (Helpers.getCbInstance() && Helpers.getCbInstance().options) {
    nonce = nonce || Helpers.getCbInstance().options.cspNonce;
  }
  if (nonce) {
    newScript.setAttribute('nonce', nonce);
    newScript.setAttribute('data-csp-nonce', nonce);
  }
  if (namespace) {
    newScript.setAttribute('data-namespace', namespace);
  }
  document.head.appendChild(newScript);
  newScript.src = url;
};

export const loadCSS = (href: string) => {
  return new Promise((resolve, reject) => {
    const ss = document.styleSheets;
    for (let i = 0, max = ss.length; i < max; i++) {
      if (ss[i].href == href) resolve(true);
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.getElementsByTagName('head')[0].appendChild(link);
    window.setTimeout(() => resolve(true), 100);
  });
};

export const getURLParams = (url: string): any => {
  const params = {};
  const parser = document.createElement('a');
  parser.href = url;
  const query = parser.search.substring(1);
  const vars = query.split('&');
  for (let i = 0; i < vars.length; i++) {
    let pair = vars[i].split('=');
    params[pair[0]] = decodeURIComponent(pair[1]);
  }
  return params;
};

export const validateRawCardDetails = (card: CardInfo): boolean => {
  if (!(card.expiryMonth && card.expiryYear && card.number)) {
    throw new CbError(Errors.missingCardDetails);
  }

  if (card.expiryYear && card.expiryYear.length == 2) {
    const currentYear = new Date().getFullYear().toString();
    card.expiryYear = currentYear.slice(0, 2) + card.expiryYear;
  }

  return true;
};

export const sanitizeAddress = (addr: Address): Address => {
  if (!addr || typeof addr != 'object' || addr.constructor !== Object) return {};
  return <Address>removeEmptyKeys({
    firstName: onlyString(addr.firstName),
    lastName: onlyString(addr.lastName),
    phone: onlyString(addr.phone),
    addressLine1: onlyString(addr.addressLine1),
    addressLine2: onlyString(addr.addressLine2),
    addressLine3: onlyString(addr.addressLine3),
    city: onlyString(addr.city),
    state: onlyString(addr.state),
    stateCode: onlyString(addr.stateCode),
    countryCode: onlyString(addr.countryCode),
    zip: onlyString(addr.zip) || typeof addr.zip === 'number' ? addr.zip.toString() : undefined,
  });
};

/**
 * Builds the paymentMethodDetails block that carries the billing contact and address for a
 * redirect or QR payment method. chargebee-app maps it onto the OpenPay payment method billing
 * address, which the gateway sends on as the billing details for the inline payment method.
 *
 * Returns undefined when the paymentInfo carries nothing, so callers can leave the key off the
 * payload entirely rather than sending an empty object.
 *
 * The address is read from additionalData.billingAddress, falling back to
 * additionalData.customerBillingAddress. Both are part of the documented paymentInfo contract, and
 * a merchant calling the SDK directly may supply either; the precedence matches
 * getCardBillingAddress. cb-checkout sends both, with billingAddress carrying the resolved
 * contact, so the fallback only applies to direct integrations.
 *
 * A top-level customer block is deliberately not built here: chargebee-app would then derive
 * customerDetails from it instead of from the stored customer record, replacing a fuller source
 * with a sparser one.
 */
export const buildBillingPaymentMethodDetails = (paymentInfo: any): Record<string, unknown> | undefined => {
  const info = paymentInfo || {};
  const additionalData = info.additionalData || {};
  const customer = sanitizeCustomerInfo({
    ...(additionalData.customer || {}),
    ...(info.customer || {}),
  } as Customer);
  const sanitizedBillingAddress = sanitizeAddress(additionalData.billingAddress as Address);
  const billingAddress = isObjectEmpty(sanitizedBillingAddress)
    ? sanitizeAddress(additionalData.customerBillingAddress as Address)
    : sanitizedBillingAddress;

  const paymentMethodDetails: Record<string, unknown> = {};
  if (!isObjectEmpty(billingAddress)) {
    paymentMethodDetails.billingAddress = billingAddress;
  }
  const email = additionalData.email || customer.email;
  if (email) {
    paymentMethodDetails.email = email;
  }
  // Stripe builds billing_details[name] from these, so they belong on paymentMethodDetails
  // itself rather than inside the nested address.
  const firstName = customer.firstName || billingAddress.firstName;
  const lastName = customer.lastName || billingAddress.lastName;
  if (firstName) {
    paymentMethodDetails.firstName = firstName;
  }
  if (lastName) {
    paymentMethodDetails.lastName = lastName;
  }
  const phone = customer.phone || additionalData.phone || billingAddress.phone;
  if (phone) {
    paymentMethodDetails.phone = phone;
  }

  return isObjectEmpty(paymentMethodDetails) ? undefined : paymentMethodDetails;
};

const QR_RENDER_INFO_KEYS = [
  'heading',
  'instruction',
  'timerLabel',
  'timerDurationSeconds',
  'waitingMessage',
  'accentColor',
  'buttonText',
];

const pickRenderInfoKeys = (source: any): Record<string, unknown> => {
  if (!source || typeof source !== 'object') return {};
  return QR_RENDER_INFO_KEYS.reduce((picked, key) => {
    if (source[key] !== undefined) picked[key] = source[key];
    return picked;
  }, {});
};

/**
 * Resolves the QR modal copy out of every shape handlePayment has accepted.
 *
 * `renderInfo` is the documented contract, but integrations written against earlier builds pass
 * the same keys flat, because the handlers used to store whatever object they were handed as
 * their render options. Those keys therefore arrive either on the paymentInfo or on the outer
 * PaymentOptions, and both still have to be honoured. Where a key is supplied in more than one
 * place, `renderInfo` wins, so an integration can migrate one key at a time.
 */
export function resolveRenderInfo<T>(options: any, paymentInfo?: any): Partial<T> {
  return {
    ...pickRenderInfoKeys(options),
    ...pickRenderInfoKeys(paymentInfo),
    ...((paymentInfo && paymentInfo.renderInfo) || {}),
  } as Partial<T>;
}

export const sanitizeCustomerInfo = (customer: Customer): Customer => {
  if (!customer || typeof customer != 'object' || customer.constructor !== Object) return {};
  return <Customer>removeEmptyKeys({
    firstName: onlyString(customer.firstName),
    lastName: onlyString(customer.lastName),
    phone: onlyString(customer.phone),
    email: onlyString(customer.email),
  });
};

export function removeEmptyKeys(data: any) {
  if (data && data.constructor === Object) {
    return Object.keys(data)
      .filter((key) => {
        if (typeof data[key] == 'undefined') return false;
        return true;
      })
      .reduce((obj, key) => {
        obj[key] = data[key];
        return obj;
      }, {});
  }
  return data;
}

export function onlyNumeric(val) {
  if (typeof val !== 'string') return val;
  return val.replace(/\D/g, '');
}

export function onlyString(val) {
  if (typeof val === 'string' && val.length) return val;
}

export function getPaymentIntentApiHeaders(data: ConfirmApiPayload) {
  const headers = {Authorization: `Bearer ${data.paymentIntentId}`};
  if (data.businessEntityId) headers[BUSINESS_ENTITY_HEADER] = data.businessEntityId;
  if (data.brandId) headers[BRAND_ID_HEADER] = data.brandId;
  return headers;
}

export function constructPaymentIntentApiPayload(
  paymentIntent: PaymentIntent,
  payload?: ConfirmApiInputPayload
): ConfirmApiPayload {
  const paymentIntentId = paymentIntent.id;
  const businessEntityId = paymentIntent.business_entity_id;
  const brandId = paymentIntent.brand_id;
  const referenceId = paymentIntent.reference_id;
  const paymentMethodType = paymentIntent.payment_method_type;
  const gatewayAccountId = paymentIntent.gateway_account_id;

  // Apply locale from cbInstance if not already set
  if (payload) {
    try {
      const cbInstance = Helpers.getCbInstance();
      if (cbInstance && cbInstance.options && cbInstance.options.locale && !payload.locale) {
        payload.locale = cbInstance.options.locale;
      }
    } catch (error) {
      Logger.kvl({action: 'locale_error', error: sanitizeError(error)});
    }
  }

  const output: ConfirmApiPayload = {
    paymentIntentId,
    payload,
  };
  if (referenceId) output.referenceId = referenceId;
  if (businessEntityId) output.businessEntityId = businessEntityId;
  if (brandId) output.brandId = brandId;
  if (gatewayAccountId) output.gatewayAccountId = gatewayAccountId;
  if (paymentMethodType) output.paymentMethodType = paymentMethodType;

  return output;
}

export function wrapWithStates(promise): StateFullPromise<any> {
  // Don't modify any promise that has been already modified.
  if (promise.isResolved) return promise;

  let isPending = true;
  let isRejected = false;
  let isResolved = false;

  const result = promise
    .then((data) => {
      isResolved = true;
      return data;
    })
    .catch((err) => {
      isRejected = true;
      throw err;
    })
    .finally(() => {
      isPending = false;
    });

  result.isResolved = function () {
    return isResolved;
  };
  result.isPending = function () {
    return isPending;
  };
  result.isFulfilled = function () {
    return !isPending;
  };
  result.isRejected = function () {
    return isRejected;
  };
  return result;
}

export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return function (...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, wait);
  };
}
