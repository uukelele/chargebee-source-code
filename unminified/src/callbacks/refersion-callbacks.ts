import {CbCallbacksInterface} from '@/interfaces/cb-types';
import {SUCCESS} from '@/constants/callbacks';
import {PageType} from '@/constants/enums';
import Helpers from '@/helpers/index';

let refersionCheckoutCallbacks: CbCallbacksInterface = {
  [SUCCESS](hostedPageId, data) {
    let _refersion = window['_refersion'];
    let _rfsn = window['_rfsn'];
    let subData = data && data.subscription;
    if (subData && _refersion && _rfsn) {
      _refersion(function () {
        _rfsn._addCart(subData.id);
        _rfsn._setSource('CHARGEBEE');
      });
    }
  },
};

/**@internal */
export default class RefersionCallbacks {
  static get(pageType: PageType): CbCallbacksInterface {
    if (
      pageType == PageType.CHECKOUT &&
      Helpers.getCbInstance().enableRefersionTracking &&
      window['_refersion'] &&
      window['_rfsn']
    ) {
      return refersionCheckoutCallbacks;
    }
    return {};
  }
}
