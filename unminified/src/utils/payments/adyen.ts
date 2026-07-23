import {PAYMENT_AUTH_REDIRECT_WINDOW_NAME} from '@/hosted_fields/common/base-types';
import {
  ConfirmApiInputPayload,
  PaymentAttempt,
  PaymentAttemptStatus,
  PaymentFlow,
  PaymentIntentResponse,
} from '@/extensions/three_domain_secure/common/types';
import {constructPaymentIntentApiPayload, loadCSS, loadScriptUsingPredicate} from '@/internal/common/utils';
import Helpers from '@/helpers';
import LightBox from '@/extensions/three_domain_secure/common/lightbox';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import Ids from '@/constants/ids';
import {Master as M} from '@/hosted_fields/common/enums';
import {ThreeDSPollingTimeouts} from '@/constants/enums';
import {jsonify} from '@/utils/utility-functions';
import {Adyen} from '@/extensions/three_domain_secure/handlers/adyen/types';
import Utils from '@/utils/payments/utils';
import {fetchGatewayCredential} from '@/utils/payments/gateway-credential';
import {ResponseInnerMessage} from '@/hosted_fields/common/types';

type AdyenConfirmActionResponse = {
  method?: 'GET' | 'POST';
  type?: 'redirect';
  url?: string;
};

export const helper = {
  hasDFLoaded() {
    // @ts-ignore
    return !!window.dfDo;
  },
};

export const NEW_ADYEN_VERSION = '6.10.0';
export const DEFAULT_ADYEN_VERSION = '5.39.0';
export const OLD_ADYEN_VERSION = '5.38.0';

const LIVE_ENVIRONMENT_KEY = 'live';

export function createHiddenForm(paymentAttempt: PaymentAttempt) {
  const rawData = paymentAttempt.action_payload;
  let redirectObj;
  if (rawData.action != null && rawData.action !== undefined) {
    redirectObj = rawData.action;
  } else {
    redirectObj = rawData.redirect;
  }

  const hiddenForm = document.createElement('form');
  hiddenForm.method = redirectObj.method;
  hiddenForm.action = redirectObj.url;

  return hiddenForm;
}

export function doPostVerification(paymentAttempt: PaymentAttempt, handler, hiddenForm): Promise<any> {
  const rawData = paymentAttempt.action_payload;
  const isRedirectMode = handler.parent.isRedirectMode && handler.getPaymentIntent().success_url;

  if (!isRedirectMode) {
    // Set form target as redirect window (To open 3DS Verification form inside the window)
    hiddenForm.target = PAYMENT_AUTH_REDIRECT_WINDOW_NAME;
  }

  document.body.appendChild(hiddenForm);

  // Auto submit form
  hiddenForm.submit();

  if (isRedirectMode) {
    return new Promise(() => {});
  }
  return handler.pollForAdyenGiropayCompletion().then((data) => {
    // Remove tab
    handler.closeTab();

    if (data['version_2']) {
      return data;
    }

    return {
      additionalInfo: {
        details: data,
        paymentData: rawData.paymentData,
      },
    };
  });
}

export function adyenCheckout() {
  return window['AdyenCheckout'];
}

export function isAdyenCheckoutLoaded(sdkVersion) {
  // For 3.22.0 version we will get window['AdyenCheckout'].version.version and for 5.39.0
  // window['AdyenCheckout'].version is undefined so if window['AdyenCheckout'] && !window['AdyenCheckout'].version,

  if (sdkVersion === NEW_ADYEN_VERSION && window['AdyenWeb']) {
    return true;
  }

  let adyenCheckout = window['AdyenCheckout'];
  if (
    adyenCheckout &&
    !adyenCheckout.version &&
    (sdkVersion == DEFAULT_ADYEN_VERSION || sdkVersion == OLD_ADYEN_VERSION)
  ) {
    return true;
  } else if (
    adyenCheckout &&
    adyenCheckout.version &&
    adyenCheckout.version.version &&
    adyenCheckout.version.version == sdkVersion
  ) {
    return true;
  }
  return false;
}

export function loadAdyenJsAndCss(version: string): Promise<[boolean, unknown]> {
  return _loadAdyenJsAndCss(version, null);
}

export function loadAdyenJsAndCssForV6(version: string, sdkLiveUrlSuffix: string): Promise<[boolean, unknown]> {
  return _loadAdyenJsAndCss(version, sdkLiveUrlSuffix);
}

function loadAdyenJsAndCssForChargebeePayments(version: string, sdkLiveUrlSuffix: string): Promise<[boolean, unknown]> {
  return _loadAdyenJsAndCss(version, sdkLiveUrlSuffix);
}

function _loadAdyenJsAndCss(version: string, sdkUrlSuffix: string) {
  let liveUrlSuffix = sdkUrlSuffix || `live`;
  const checkoutURL = Helpers.isTestSite(Helpers.getCbInstance().site)
    ? `https://checkoutshopper-test.cdn.adyen.com/checkoutshopper/sdk/${version}/`
    : `https://checkoutshopper-${liveUrlSuffix}.adyen.com/checkoutshopper/sdk/${version}/`;
  return Promise.all([
    loadScriptUsingPredicate(checkoutURL + 'adyen.js', () => !!isAdyenCheckoutLoaded(version)),
    loadCSS(checkoutURL + 'adyen.css'),
  ]);
}

function pollFor3DSCompletion(handler) {
  const paymentIntentId = handler.getPaymentIntent().id;
  return IframeClientLoader.then((cbIframeClient) =>
    cbIframeClient.send(
      {
        action: M.Actions.PollPaymentIntent3DSResult,
        data: {paymentIntentId},
      },
      Ids.MASTER_FRAME,
      {timeout: ThreeDSPollingTimeouts.DEFAULT}
    )
  );
}

function create3dsHiddenForm(paymentAttempt: PaymentAttempt, handler) {
  const rawData = paymentAttempt.action_payload;

  if (!rawData || (!rawData.action && !rawData.redirect)) {
    throw new CbError(Errors.missingAdyenRedirectInfo);
  }

  const hiddenForm = document.createElement('form');
  let redirectObj;
  if (rawData.action) {
    redirectObj = rawData.action;
  } else {
    redirectObj = rawData.redirect;
  }
  hiddenForm.method = redirectObj.method;
  hiddenForm.action = redirectObj.url;

  // Attach meta info as query params to redirect url
  const baseUrl = redirectObj.data['TermUrl'];
  // @ts-ignore
  const jsDomain = __JS_DOMAIN__;
  const src = encodeURIComponent(jsDomain);

  /**
   * Bancontact API handler takes care of adding paymentIntentId as a query param
   * to the redirect URL. Hence adding check to prevent malformed redirect URL
   */
  const paymentIntent = handler.getPaymentIntent();
  if (paymentIntent.payment_method_type === 'bancontact') {
    redirectObj.data['TermUrl'] = baseUrl;
  } else {
    redirectObj.data['TermUrl'] = `${baseUrl}?paymentIntentId=${handler.getPaymentIntent().id}&src=${src}`;
  }

  // Create hidden input fields to pass params on form submit
  Object.keys(redirectObj.data).map((urlParam) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = urlParam;
    input.value = redirectObj.data[urlParam];
    hiddenForm.appendChild(input);
  });

  return hiddenForm;
}

function handleRedirect(paymentAttempt: PaymentAttempt, handler): Promise<any> {
  // Handle redirect flow
  const rawAction = paymentAttempt.action_payload && paymentAttempt.action_payload.action;
  let action: AdyenConfirmActionResponse;

  if (typeof rawAction === 'string') {
    try {
      // Try to parse as JSON first (in case it's a stringified JSON object)
      action = JSON.parse(rawAction) as AdyenConfirmActionResponse;
    } catch (e) {
      throw new CbError('Invalid action payload');
    }
  } else {
    action = rawAction as AdyenConfirmActionResponse;
  }

  const actionObj = action;
  if (handler.getPaymentIntent().success_url) {
    window.top.location.href = actionObj.url;
    return Promise.resolve({});
  } else if (actionObj.method === 'GET' && actionObj.type === 'redirect') {
    if (handler.callbacks && handler.callbacks.challenge) {
      handler.callbacks.challenge(actionObj.url);
      return pollFor3DSCompletion(handler).then((data: PaymentIntentResponse) => {
        handler.setPaymentIntent(data.payment_intent);
        return handler.handlePaymentAttempt(handler.getPaymentAttempt());
      });
    } else {
      //This applies to all redirection flows without challenge callbacks
      if (handler.windowManager) {
        handler.windowManager.loadURL(actionObj.url);
        return handler.pollForAuthCompletion();
      }
      window.top.location.href = actionObj.url;
    }
  }

  // Fallback to 3DS1 Redirection
  return do3DS1Verification(paymentAttempt, handler).then((data) => {
    const updatedIntent =
      data && data.additionalInfo && data.additionalInfo.details && data.additionalInfo.details.payment_intent;
    if (
      handler.getPaymentIntent().payment_method_type === 'bancontact' ||
      (updatedIntent &&
        updatedIntent.payment_method_type === 'google_pay' &&
        updatedIntent.status === PaymentAttemptStatus.AUTHORIZED)
    ) {
      handler.setPaymentIntent(updatedIntent);
      return handler.handlePaymentAttempt(handler.getPaymentAttempt());
    } else {
      return handler.confirmPayment(data).catch((err) => {
        if (err && err.message === 'Payment intent is authorized') {
          handler.kvl({
            action: 'adyen_3ds_retrieve_completion_fallback',
            payment_method_type: handler.getPaymentIntent().payment_method_type,
          });
          return retrievePaymentIntent(handler.getPaymentIntent().id).then((data) => {
            handler.setPaymentIntent(data.payment_intent);
            return handler.handlePaymentAttempt(handler.getPaymentAttempt());
          });
        } else {
          throw new CbError(err);
        }
      });
    }
  });
}

export function retrievePaymentIntent(paymentIntentId: string): Promise<PaymentIntentResponse> {
  return IframeClientLoader.then((cbIframeClient) =>
    cbIframeClient.send(
      {
        action: M.Actions.RetrievePaymentIntent,
        data: {
          paymentIntentId,
        },
      },
      Ids.MASTER_FRAME,
      {timeout: 10000}
    )
  );
}

function pollFor3DS1Completion(paymentIntent) {
  return IframeClientLoader.then((cbIframeClient) =>
    cbIframeClient.send(
      {
        action: M.Actions.PollAdyen3DS1,
        data: {paymentIntentId: paymentIntent.id},
      },
      Ids.MASTER_FRAME,
      {timeout: ThreeDSPollingTimeouts.DEFAULT}
    )
  );
}

export function do3DS1Verification(paymentAttempt: PaymentAttempt, handler): Promise<any> {
  const rawData = paymentAttempt.action_payload;

  const hiddenForm = create3dsHiddenForm(paymentAttempt, handler);
  const iframe = handler.createIframe();
  handler.openIframe();

  // Set form target as Iframe (To open 3DS Verification form inside the iframe)
  hiddenForm.target = iframe.name;

  document.body.appendChild(hiddenForm);
  // Auto submit form
  hiddenForm.submit();

  setTimeout(() => handler.hideIframeLoader(), 3000);

  if (handler.getPaymentIntent().payment_method_type === 'google_pay') {
    return pollFor3DSCompletion(handler)
      .then((data: PaymentIntentResponse) => {
        handler.kvl({
          action: 'adyen_3ds_retrieve_completion',
          payment_method_type: handler.getPaymentIntent().payment_method_type,
        });

        return {
          additionalInfo: {
            details: data,
            paymentData: rawData.paymentData,
          },
        };
      })
      .finally(() => handler.removeIframe());
  }
  return pollFor3DS1Completion(handler.getPaymentIntent()).then((data) => {
    // Remove iframe
    handler.removeIframe();

    return {
      additionalInfo: {
        details: data,
        paymentData: rawData.paymentData,
      },
    };
  });
}

function createPlaceholderElement(handler) {
  handler.lightbox = new LightBox('adyen');
  const containerEl = document.createElement('div');
  containerEl.className = 'frame-contents no-spinner';
  containerEl.id = 'cb-adyen-3ds-webcomponent';
  handler.lightbox.getWrapperEl().appendChild(containerEl);
  handler.openIframe();
  return containerEl;
}

function removePlaceholderElement(handler) {
  handler.removeIframe();
}

function onAdditionalDetails(state, component, handler) {
  if (handler.adyenActionResolver) {
    const payload = {
      additionalInfo: state.data,
    };
    handler.adyenActionResolver(payload);
    removePlaceholderElement(handler);
    handler.adyenActionResolver = null;
  }
}

function generateOriginKey(intent): Promise<string> {
  const data: any = constructPaymentIntentApiPayload(intent);
  data.origin = window.location.origin;

  return IframeClientLoader.then((cbIframeClient) =>
    cbIframeClient.send(
      {
        action: M.Actions.GenerateAdyenOriginKey,
        data,
      },
      Ids.MASTER_FRAME,
      {timeout: 10000}
    )
  ).then((data: any) => {
    const keys = data.keys;
    const originKey: string = keys[window.location.origin];
    return originKey;
  });
}

async function createAdyenCheckoutInstance(originKey: any, handler, liveEnvironment: string = LIVE_ENVIRONMENT_KEY) {
  if (!originKey || typeof originKey !== 'string') {
    Promise.reject(new CbError(Errors.invalidAdyenOriginKey));
  }

  const environment = Helpers.isTestSite() ? 'test' : liveEnvironment;
  // @ts-ignore
  const adyenClient = await new window.AdyenCheckout({
    environment,
    originKey,
    clientKey: originKey,
    onAdditionalDetails: (state, component) => {
      onAdditionalDetails(state, component, handler);
    },
    onChange: (data) => {
      //
    },
    onError: (err) => {
      throw new CbError(handler.sanitizeAdyenError(err));
    },
  });
  return Promise.resolve(adyenClient);
}

function setChallengeWindowSize(containerEl, challengeWindowSize) {
  const threeDSConfiguration = {
    '01': ['250px', '400px'],
    '02': ['390px', '400px'],
    '03': ['500px', '600px'],
    '04': ['600px', '400px'],
    '05': ['100%', '100%'],
  };
  const windowConfig = threeDSConfiguration[challengeWindowSize];
  if (windowConfig) {
    containerEl.setAttribute('style', `width:${windowConfig[0]} !important; height:${windowConfig[1]} !important`);
  }
}

function handleAdyenAction(paymentAttempt: PaymentAttempt, handler, adyenClient) {
  const rawResponse = paymentAttempt.action_payload;
  const containerEl = createPlaceholderElement(handler);

  return new Promise((resolve, reject) => {
    handler.adyenActionResolver = resolve;
    const challengeWindowSize =
      handler.paymentInfo &&
      handler.paymentInfo.additionalData &&
      handler.paymentInfo.additionalData.challengeWindowSize;
    setChallengeWindowSize(containerEl, challengeWindowSize);
    const threeDSConfiguration = challengeWindowSize
      ? {
          challengeWindowSize: challengeWindowSize,
        }
      : {};

    const action = rawResponse.type ? rawResponse : rawResponse.action;
    adyenClient.createFromAction(action, threeDSConfiguration).mount(`#${containerEl.id}`);
  });
}

export function createAdyenInstance(intent, handler) {
  return _createAdyenInstance(
    intent,
    handler,
    (version) => loadAdyenJsAndCss(version),
    () => LIVE_ENVIRONMENT_KEY
  );
}

// Chargebee Payments uses Adyen behind the scenes.
export function createAdyenInstanceForChargebeePayments(intent, handler) {
  return _createAdyenInstance(
    intent,
    handler,
    (version, gwData) => loadAdyenJsAndCssForChargebeePayments(version, gwData.sdk_live_url_suffix),
    (gwData) => gwData.sdk_live_url_suffix
  );
}

function _createAdyenInstance(
  intent,
  handler,
  loadAdyenJsAndCssPromise: (sdkVersion: string, gatewayData: any) => Promise<[boolean, unknown]>,
  getLiveEnvironment: (gwData: any) => string
) {
  let promise = fetchGatewayCredential(handler.getPaymentIntent());
  return promise.then((gwData) => {
    const version = gwData.js_version || DEFAULT_ADYEN_VERSION;
    return loadAdyenJsAndCssPromise(version, gwData).then(() => {
      const originKey =
        version === DEFAULT_ADYEN_VERSION || version === OLD_ADYEN_VERSION
          ? gwData.client_key
          : gwData.origin_key[window.location.origin];
      return createAdyenCheckoutInstance(originKey, handler, getLiveEnvironment(gwData));
    });
  });
}

export function adyenHandlePaymentAttempt(paymentAttempt: PaymentAttempt, handler, adyenClient): Promise<any> {
  return Promise.resolve(true).then(() => {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_IDENTIFICATION: {
        // handler.callChange();
        return handleAdyenAction(paymentAttempt, handler, adyenClient).then((data) => handler.confirmPayment(data));
      }

      case PaymentAttemptStatus.REQUIRES_CHALLENGE: {
        // handler.callChange();
        return handleAdyenAction(paymentAttempt, handler, adyenClient).then((data) => handler.confirmPayment(data));
      }

      case PaymentAttemptStatus.REQUIRES_REDIRECTION: {
        // handler.callChange();
        return handleRedirect(paymentAttempt, handler);
      }

      case PaymentAttemptStatus.AUTHORIZED: {
        handler.callSuccess();
        return true;
      }

      case PaymentAttemptStatus.REFUSED:
      default: {
        throw handler.intentError();
      }
    }
  });
}

export function doManualDeviceFingerprinting(payload: any, handler) {
  return new Promise((resolve, reject) => {
    if (helper.hasDFLoaded()) {
      // Create hidden input
      const input = document.createElement('input');
      const id = `adyen_fingerprint_${new Date().getTime()}`;
      input.setAttribute('type', 'hidden');
      input.id = id;
      document.body.appendChild(input);

      try {
        // @ts-ignore
        window.dfDo(id);
        // @ts-ignore
        window.dfSet(id, 0);
      } catch (e) {
        handler.kvl({
          ...jsonify(e),
          action: 'gateway_client_error',
          gw: 'adyen',
          description: 'Manual device fingerprinting failed',
        });
        return resolve(payload);
      }

      const deviceFingerprint = input.value;
      if (deviceFingerprint) payload.deviceFingerprint = deviceFingerprint;
      resolve(payload);
    } else {
      resolve(payload);
    }
  });
}

export function sanitizeAdyenError(error: Adyen.Error = {}, handler) {
  handler.kvl({
    ...jsonify(error),
    action: 'gateway_client_error',
    gw: 'adyen',
  });
  if (error.errorCode) {
    return new CbError(
      {
        name: (error.errorCode + '').toUpperCase(),
        message: error.message,
        code: error.status,
        type: error.errorType,
      },
      error
    );
  } else {
    return new CbError(error, error);
  }
}

export function handleCardpayment(handler): Promise<ConfirmApiInputPayload> {
  const hasRawCardDetails = !!handler.paymentInfo.card;
  const hasReferenceId = !!handler.getReferenceId();
  const hasCardComponent = !!handler.paymentInfo.cardComponent;
  const hasPaymentComponent = !!handler.paymentInfo.paymentComponent;

  const payload: ConfirmApiInputPayload = {
    ...Utils.getBrowserFingerprint(),
  };

  if (handler.paymentInfo.element) {
    try {
      payload.paymentMethod = handler.paymentInfo.element.data.paymentMethod;
    } catch (err) {
      handler.callError(new CbError(Errors.invalidChargebeePaymentCheckoutInstance, err));
    }
  }

  if (handler.hasAdditionalData()) {
    const additionalData = handler.paymentInfo.additionalData;
    if (additionalData.encryptedCardDetails) {
      payload.additionalInfo = {
        ...payload.additionalInfo,
        encryptedCardDetails: additionalData.encryptedCardDetails,
      };
    }

    payload.cardBillingAddress = handler.getCardBillingAddress();
    payload.customerBillingAddress = additionalData.billingAddress;
    payload.customer = additionalData.customer;

    if (additionalData.email) {
      payload.email = additionalData.email;
    }
    if (additionalData.phone) {
      payload.customer = {
        ...payload.customer,
        phone: additionalData.phone,
      };
    }
  }

  if (handler.paymentInfo.card) {
    payload.paymentMethod = handler.paymentInfo.card;
  }

  if (hasCardComponent) {
    payload.cardComponent = handler.paymentInfo.cardComponent;
  }

  if (hasPaymentComponent) {
    payload.paymentComponent = handler.paymentInfo.paymentComponent;
  }

  if (handler.callbacks.challenge) {
    payload.paymentFlow = PaymentFlow.REDIRECT;
  }

  const paymentIntent = handler.getPaymentIntent();
  if (paymentIntent && paymentIntent.payment_method_type) {
    payload.paymentMethodType = paymentIntent.payment_method_type;
  }

  const urlPrefix = Helpers.isTestSite() ? 'test' : LIVE_ENVIRONMENT_KEY;
  return hasRawCardDetails || hasReferenceId || hasCardComponent || hasPaymentComponent
    ? loadScriptUsingPredicate(
        `https://${urlPrefix}.adyen.com/hpp/js/df.js?v=${new Date().getTime()}`,
        helper.hasDFLoaded
      ).then(() => doManualDeviceFingerprinting(payload, handler))
    : Promise.resolve(payload);
}
