import qs from 'qs';
import EnvConstants, {debugMode} from '@/constants/environment';
import {loadScript} from '../../common/utils';
import Logger from '@/utils/logger_old';
import {ThreeDSHandler} from '@/hosted_fields/common/base-types';
import {AdditionalData, PaymentInfo, PaymentIntent} from '../../common/types';

declare var Chargebee;
const PAYMENT_INTENT_EXTERNAL_ID_PARAM_NAME = 'cb_payment_intent_id';
declare global {
  interface Window {
    cbSiteInfo: {
      site: string;
      publishableKey: string;
    };
  }
}

Logger.init();

var cbInstance;
function getPayload() {
  try {
    const url = new URL(window.location.href);
    return qs.parse(url.search);
  } catch (e) {
    if (debugMode()) console.error(e);
  }
  return {};
}

async function handlePayment(threeDSHandler: ThreeDSHandler) {
  const {cbToken, ...rest} = getPayload();
  const additionalData: AdditionalData = rest;

  // Setting this flag to avoid re-initiating a redirect when success & failure URL is configured for braintree
  additionalData._skipRedirect = true;

  const paymentInfo: PaymentInfo = {
    additionalData,
  };
  if (cbToken) paymentInfo.cbToken = cbToken as string;
  return threeDSHandler.handleCardPayment(paymentInfo);
}

async function load3DSHandler(): Promise<ThreeDSHandler> {
  const payload = getPayload();
  const threeDSHandler = await cbInstance.load3DSHandler();
  const {payment_intent} = await threeDSHandler.retrievePaymentIntent(payload.paymentIntentId);
  threeDSHandler.setPaymentIntent(payment_intent);
  return threeDSHandler;
}

function initSentry() {
  try {
    const url = new URL(window.location.href);
    Logger.setScope({
      site: window.cbSiteInfo.site,
      domain: url.origin,
      hostName: url.host,
    });
  } catch (e) {
    if (debugMode()) console.error(e);
  }
}

function initChargebeeJS() {
  cbInstance = Chargebee.init({
    site: window.cbSiteInfo.site,
    publishableKey: window.cbSiteInfo.publishableKey,
  });
}

async function loadChargebeeJS() {
  const src = `${EnvConstants.JS_DOMAIN}/v2/chargebee.js`;
  return loadScript(src, 'Chargebee');
}

function redirectToUrl(url: string, intentId: string) {
  const redirectUrl = new URL(url);
  redirectUrl.searchParams.append(PAYMENT_INTENT_EXTERNAL_ID_PARAM_NAME, intentId);
  window.location.href = redirectUrl.toString();
}

(async function () {
  let intent: PaymentIntent;
  try {
    initSentry();
    await loadChargebeeJS();
    await initChargebeeJS();
    const threeDSHandler = await load3DSHandler();
    intent = threeDSHandler.getPaymentIntent();
    await handlePayment(threeDSHandler);
    if (intent && intent.success_url) {
      redirectToUrl(intent.success_url, intent.id);
    }
  } catch (e) {
    console.error(e);
    if (intent && intent.failure_url) {
      redirectToUrl(intent.failure_url, intent.id);
    }
  }
})();
