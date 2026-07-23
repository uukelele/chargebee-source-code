import {loadScript} from '@/extensions/three_domain_secure/common/utils';
import {Master as M} from '@/hosted_fields/common/enums';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import Ids from '@/constants/ids';
import Helpers from '@/helpers/index';
import {constructPaymentIntentApiPayload} from '@/internal/common/utils';
import {PaymentIntent} from '@/internal/payment-intent/types';
import DeviceDataHelpers from '@/helpers/device-data';

/**
 * Get the Bluesnap SDK instance from the window object
 */
export function getBluesnap() {
  return window['bluesnap'];
}

/**
 * Load the Bluesnap SDK script
 */
export function loadBluesnap(): Promise<any> {
  const BLUESNAP_DOMAIN_PATH = Helpers.isTestSite() ? 'https://sandbox.bluesnap.com' : 'https://ws.bluesnap.com';
  return loadScript(`${BLUESNAP_DOMAIN_PATH}/web-sdk/5/bluesnap.js`, 'bluesnap');
}

/**
 * Create a payment form token for Bluesnap
 */
export function createPfToken(paymentIntent: PaymentIntent, vaultId?: string): Promise<any> {
  let body = {};
  if (vaultId) {
    body = {
      referenceId: vaultId,
    };
  }
  return IframeClientLoader.then((cbIframeClient) =>
    cbIframeClient.send(
      {
        action: M.Actions.CreateBluesnapPfToken,
        data: constructPaymentIntentApiPayload(paymentIntent, body),
      },
      Ids.MASTER_FRAME,
      {timeout: 120000}
    )
  );
}

/**
 * Load device data check for Bluesnap
 */
export function loadDeviceDataCheck(paymentInfo: any): Promise<string> {
  const {cbToken = '', additionalData: {additionalInformation: {bluesnap = {}} = {}} = {}} = paymentInfo;
  if (cbToken && bluesnap && bluesnap.fraud && bluesnap.fraud.fraud_session_id) {
    return Promise.resolve(bluesnap.fraud.fraud_session_id);
  }
  if (!paymentInfo.card && !paymentInfo.cbToken) {
    return Promise.resolve(null);
  }
  return DeviceDataHelpers.getBluesnapSessionId(Helpers.isTestSite());
}
