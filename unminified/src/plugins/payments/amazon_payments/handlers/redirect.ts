import {loadScript} from '@/extensions/three_domain_secure/common/utils';
import {debugMode} from '@/constants/environment';
import Logger from '@/utils/logger_old';
const AMAZON_JS_URL = 'https://static-na.payments-amazon.com/checkout.js';

function logError(error) {
  if (debugMode) {
    logError(error);
  }
}

function getPayload(event) {
  try {
    return event.data;
  } catch (error) {
    logError('Error parsing payload: ' + error.message);
    return null;
  }
}

function initAmazonPayCheckout(data) {
  const {gwData, intent, sandbox} = data;

  if (gwData && intent) {
    try {
      window['amazon'].Pay.initCheckout({
        merchantId: gwData.merchantId,
        sandbox: sandbox,
        publicKeyId: gwData.publicKeyId,
        ledgerCurrency: gwData.ledgerCurrency,
        placement: gwData.placement,
        estimatedOrderAmount: {
          amount: intent.amount,
          currencyCode: intent.currency_code,
        },
        createCheckoutSessionConfig: {
          payloadJSON: gwData.payload,
          signature: gwData.signature,
          publicKeyId: gwData.publicKeyId,
        },
      });
    } catch (error) {
      logError('Error initializing Amazon Pay Checkout: ' + error.message);
    }
  } else {
    logError('Missing data for Amazon Pay checkout.');
  }
}

function initMessageListener() {
  window.addEventListener('message', (event) => {
    const payload = getPayload(event);
    if (payload) {
      initAmazonPayCheckout(payload);
    }
  });
}

async function loadChargebeeJS() {
  loadScript(AMAZON_JS_URL, 'amazon');
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
    if (debugMode()) logError(e);
  }
}

(async function () {
  initSentry();
  await loadChargebeeJS();
  try {
    initMessageListener();
  } catch (error) {
    logError('Error during script initialization: ' + error.message);
  }
})();
