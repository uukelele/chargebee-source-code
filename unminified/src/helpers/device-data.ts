import {loadScript} from '@/extensions/three_domain_secure/common/utils';

export default class DeviceDataHelpers {
  static getBluesnapSessionId(isTestSite, kountMerchantId?): Promise<string> {
    return new Promise((resolve, reject) => {
      // Hack to fix https://mychargebee.atlassian.net/browse/CHKOUTENGG-8739
      // collect-end is not getting invoked for the second time collectData() request for the same session-id
      if (window['ka']) {
        window['ka'] = undefined;
      }
      // https://developers.bluesnap.com/docs/fraud-prevention#section-device-data-checks
      let KOUNT_DOMAIN_PATH = isTestSite ? 'https://tst.kaptcha.com' : 'https://ssl.kaptcha.com';
      let kountMId = kountMerchantId || '700000';
      loadScript(`${KOUNT_DOMAIN_PATH}/collect/sdk?m=${kountMId}`, 'ka')
        .then(() => {
          const ka = window['ka'];
          let client = new ka.ClientSDK();
          client.setupCallback({
            'collect-end': () => {
              resolve(ka.sessionId);
            },
          });
          client.collectData();
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  static getBraintreeDeviceData(braintree, braintreeInstance): Promise<object> {
    let emp = {device_session_id: null, fraud_merchant_id: null};
    if (!braintree || !braintreeInstance) {
      return Promise.resolve(emp);
    }
    return braintree.dataCollector
      .create({
        client: braintreeInstance,
        kount: true,
      })
      .then((dataCollectorInstance) => {
        try {
          return JSON.parse(dataCollectorInstance.deviceData);
        } catch (err) {
          return emp;
        }
      });
  }
}
