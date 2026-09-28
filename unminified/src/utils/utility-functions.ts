import Transformer from '@/helpers/transformer';
import Ids from '@/constants/ids';
import {Host, MessageHandler, WindowType} from '@/hosted_fields/common/enums';
import {CommunicationMessage} from '@/hosted_fields/common/types';
import {debugMode} from '@/constants/environment';

export function flattenObj(input, separator = '.', depth = 0) {
  if (depth > 4) return;
  try {
    switch (typeof input) {
      case 'object': {
        if (input == null) return input;
        if (input.constructor === Array) return JSON.stringify(input);

        return Object.keys(input).reduce((finalObj, key) => {
          const flatObj = flattenObj(input[key], separator, depth + 1);
          if (flatObj && typeof flatObj === 'object') {
            Object.keys(flatObj).map((innerKey) => {
              finalObj[`${key}${separator}${innerKey}`] = flatObj[innerKey];
            });
          } else {
            finalObj[key] = flatObj;
          }
          return finalObj;
        }, {});
      }
      case 'undefined':
        return typeof input;
      case 'string':
      case 'boolean':
      case 'number':
      default:
        return input;
    }
  } catch (e) {
    if (debugMode()) {
      console.error(e);
    }
  }
  return input;
}

// Used to convert error object to proper json object
export function jsonify(data) {
  if (typeof data === 'string') {
    return data;
  }
  try {
    let obj = JSON.parse(JSON.stringify(data));
    obj = {
      ...obj,
      message: data.message,
      name: data.name,
    };
    return obj;
  } catch (e) {
    if (debugMode()) {
      console.error(e);
    }
    return data;
  }
}

// Used to convert error object to proper json object in gateway module expected error format
export function gwJsonify(data) {
  if (typeof data === 'string') {
    return data;
  }
  try {
    let obj = JSON.parse(JSON.stringify(data));
    obj = {
      ...obj,
      message: data.message,
      gw_unified_error: data.message,
      name: data.name,
    };
    return obj;
  } catch (e) {
    if (debugMode()) {
      console.error(e);
    }
    return data;
  }
}

export function safeGet(object = {}, key = '') {
  if (!(typeof object === 'object' && object.constructor === Object) || typeof key !== 'string') return undefined;

  if (!key) return object;

  return key.split('.').reduce((a, b) => (a || {})[b], object);
}

// Supports only till depth = 1
export function flattenAPIPayload(data: any) {
  let payload = {};
  Object.keys(data).map((key) => {
    const value = data[key];
    switch (typeof value) {
      case 'object': {
        if (Array.isArray(value) && value.length && typeof value[0] === 'object' && !Array.isArray(value[0])) {
          payload = {...payload, ...Transformer.flattenArray(value, key)};
        } else {
          payload = {...payload, ...Transformer.flatten(value, key)};
        }
        break;
      }
      case 'string':
      case 'number':
      case 'boolean':
      case 'undefined':
      default: {
        payload[key] = value;
        break;
      }
    }
  });
  return payload;
}

export function sendKVL(data: any = {}) {
  // Sending message to self (handled via host-actions/master-actions)
  // Cannot import cb-iframe-client (circular dependency)
  const cbjsSource = window.CbJsSource;
  if (cbjsSource) {
    data.cbjs_source = cbjsSource;
  }
  window.postMessage(
    {
      cbEvent: true,
      targetWindowName: Ids.HOST_NAME,
      srcWindowName: Ids.HOST_NAME,
      message: {
        action: Host.Actions.CaptureKVL,
        data: jsonify(data),
      },
    },
    window.location.origin
  );
}

export function captureException(data: any = {}) {
  // Sending message to self (handled via host-actions/master-actions)
  window.postMessage(
    {
      cbEvent: true,
      targetWindowName: Ids.HOST_NAME,
      srcWindowName: Ids.HOST_NAME,
      message: {
        action: Host.Actions.CaptureException,
        data: jsonify(data),
      },
    },
    window.location.origin
  );
}

/**
 * Checks if an object is empty (has no own enumerable properties).
 *
 * @param {Object} data - The object to be checked for emptiness.
 * @returns {boolean} Returns `true` if the object is empty, `false` otherwise.
 */
export function isObjectEmpty(data) {
  if (data == undefined || data == null) return true;
  return !!data && !Object.keys(data).length;
}

/**
 * Gets a timestamp with the option to reset based on a specified interval.
 *
 * @param {number} [resetMarkInMinutes=15] - The interval in minutes for resetting the timestamp.
 * @returns {number} The timestamp in seconds.
 */
export function getTimestamp(resetMarkInMinutes = 15): number {
  const now = new Date();
  now.setMilliseconds(0);
  now.setSeconds(0);
  // Resets every 5 minutes
  const minuteMark = now.getMinutes() - (now.getMinutes() % resetMarkInMinutes);
  return now.setMinutes(minuteMark) / 1000;
}

// Performs only format validation
export function isValidLocale(locale: string): boolean {
  if (locale && typeof locale == 'string') {
    if (locale.length == 2) return true;
    if (locale.length == 5) return locale.split('-').every((langCode) => langCode.length == 2);
  }
  return false;
}

export function isCbDomain(hostName) {
  const predevCounter = Array.apply(0, Array(50)).map(function (_: any, b: number) {
    return b + 1;
  });
  const CB_DOMAINS = [
    'localcb.in:8080',
    'localcb.in:8082',
    'localcb.in:8443',
    'devcb.in',
    'devcbportal.in',
    'stagingcb.com',
    'stagingcbportal.com',
    'predev.in',
    'predevportal.in',
  ]
    .concat(Array.from ? Array.from(predevCounter, (x) => `predev${x}.in`) : [])
    .concat(Array.from ? Array.from(predevCounter, (x) => `predev${x}portal.in`) : []);

  return CB_DOMAINS.filter((domain) => hostName.endsWith(domain)).length > 0;
}

function safeGetParam(object, param) {
  try {
    return object[param];
  } catch (e) {
    // ignore
  }
  return undefined;
}

export function safeExecute(method: Function, args: Array<any> = []) {
  if (method && typeof method === 'function') {
    try {
      method.apply(this, args);
    } catch (e) {
      // ignore error
    }
  }
}

export type ErrorJson = {
  cb_error_message: string;
  cb_error_name: string;
};

export function jsonifyError(error: Error): ErrorJson | undefined {
  if (error) {
    return {
      cb_error_message: error.message,
      cb_error_name: error.name,
    };
  }
}

function getWindowTypeName(windowType: WindowType): String {
  switch (windowType) {
    case WindowType.Master:
      return 'master';
    case WindowType.Component:
      return 'component';
    case WindowType.Host:
      return 'host';
    default:
      return 'none';
  }
}

export function checkoutLogKVL(data) {
  // Add wrapper source to KVL data
  const cbjsSource = window.CbJsSource;
  if (cbjsSource) {
    data.cbjs_source = cbjsSource;
  }

  // @ts-ignore
  if (window.logger && window.logger.kvl) {
    // @ts-ignore
    window.logger.kvl(data);
  } else {
    console.log(data);
  }
}

export function logTargetWindow(payload) {
  if (!payload) return;
  try {
    const {targetWindow, message, targetIframeName, windowType, handlerType} = payload;
    if (targetWindow && typeof targetWindow.postMessage === 'function') return;

    const kvlData: any = {
      message_action: message.action,
      message_target_iframe: targetIframeName,
      window_type: getWindowTypeName(windowType),
      handler_type: handlerType,
    };

    if (!targetWindow) {
      kvlData.target_window_present = false;
    } else {
      kvlData.target_window_present = true;
      kvlData.window_obj_name = safeGetParam(targetWindow, 'name');
      kvlData.window_src = window.location.href;
      kvlData.post_message_present = !!targetWindow.postMessage;

      safeExecute(() => {
        kvlData.target_window_closed = targetWindow.closed;
        kvlData.window_obj_primitive_type = typeof targetWindow;
        kvlData.window_obj_constructor = window.constructor && window.constructor.name;
        kvlData.window_obj_type = targetWindow.toString();
      });
    }

    safeExecute(() => {
      const iframes = [].slice.call(document.getElementsByTagName('iframe'));
      iframes.map((frame, index) => {
        if (frame.id) kvlData[`iframe_id_${index}`] = frame.id;
        if (frame.name) kvlData[`iframe_name_${index}`] = frame.name;
        if (frame.baseURI) kvlData[`iframe_src_${index}`] = frame.src;
      });
    });

    checkoutLogKVL(kvlData);
  } catch (e) {
    // console.error(e);
    // ignore
  }
}

try {
  // @ts-ignore
  window.cb_window_logger = logTargetWindow;
} catch (e) {
  // window ReferenceError in serviceWorker
}

export function iframePostMessage(
  targetWindow: Window | HTMLIFrameElement,
  payload: CommunicationMessage,
  targetDomain: string,
  handler?: MessageHandler
): void {
  if (debugMode()) {
    console.log('message sent to', targetDomain, 'message: ', payload);
  }

  if (!targetWindow) return;

  if (targetWindow instanceof HTMLIFrameElement) {
    // CHKOUTENGG-8543
    // For Instagram/Facebook in-app browsers
    // window.frames returns a HTMLIframeElement instead of Window
    const logData: any = {
      message_handler: handler,
    };
    try {
      logData.window_obj_type = 'HTMLIFrameElement';
      logData.content_window_present = !!targetWindow.contentWindow;
      logData.post_message_present = !!(targetWindow.contentWindow && targetWindow.contentWindow.postMessage);

      if (targetWindow.contentWindow) {
        targetWindow.contentWindow.postMessage(payload, targetDomain);
        logData.message_status = 'success';
      }
    } catch (e) {
      console.error(e);

      logData.message_status = 'error';
      logData.post_message_error_name = e.name;
      logData.post_message_error_message = e.message;
    }

    checkoutLogKVL(logData);
    return;
  } else {
    targetWindow.postMessage(payload, targetDomain);
  }
}

export function intentError(intent) {
  const attempt = intent.active_payment_attempt;

  if (attempt.error_code || attempt.error_text || attempt.error_msg) {
    let message = attempt.error_text || attempt.error_msg || '';
    message = message.split('request-id')[0].trim();
    return {
      name: `PAYMENT_ATTEMPT_${attempt.status.toUpperCase()}`,
      code: attempt.error_code,
      message,
      detail: attempt.error_detail || {},
    };
  }
}

export function requiredAll(...args: any[]): boolean {
  return args && args.every((cond) => !!cond);
}

export function requiredAnyOne(...args: any[]): boolean {
  return args && args.some((cond) => !!cond);
}

export function isWindowsOS() {
  return window.navigator && window.navigator.userAgent && window.navigator.userAgent.includes('Win');
}

export function isSafariMacOS() {
  return (
    !!window['safari'] && window.navigator && window.navigator.userAgent && window.navigator.userAgent.includes('Mac')
  );
}

export function isMobileSafari(): boolean {
  const ua = window.navigator && window.navigator.userAgent;
  if (!ua) return false;
  return /iP(hone|od|ad)/.test(ua) && /WebKit/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
}

/**
 * True while the browser still honours `window.open` for the last user gesture. Browsers that
 * do not expose `navigator.userActivation` are treated as active, so the open is attempted and
 * the blocked result is detected afterwards instead.
 */
export function hasTransientUserActivation(): boolean {
  const userActivation = window.navigator && (window.navigator as any).userActivation;
  if (!userActivation || typeof userActivation.isActive !== 'boolean') return true;
  return userActivation.isActive;
}

export function getCurrencyDivisor(currency) {
  let maxFractionDigit = 2;
  if (['JPY', 'KRW'].includes(currency)) {
    maxFractionDigit = 0;
  }
  return Math.pow(10, maxFractionDigit);
}

export function removeNullUndefinedEmpty(obj) {
  const entries = Object.entries(obj).filter(([, value]) => value != null && value != '');
  const out = {};
  entries.forEach(([key, v]) => {
    if (v && Array.isArray(v)) {
      out[key] = v;
      return;
    }
    const value = typeof v == 'object' ? removeNullUndefinedEmpty(v) : v;
    out[key] = value;
  });
  return out;
}

export function isValidURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
}

export function getBeneficiaryName(input) {
  if (input.bankAccount.nameOnAccount) {
    return input.bankAccount.nameOnAccount;
  }

  if (input.customer && input.customer.firstName && input.customer.lastName) {
    return input.customer.firstName + ' ' + input.customer.lastName;
  }

  if (input.customer && input.customer.firstName) {
    return input.customer.firstName;
  }

  if (input.customer && input.customer.lastName) {
    return input.customer.lastName;
  }
}
