import {CbCallbacksInterface} from '@/interfaces/cb-types';
import {SUCCESS, LOADED} from '@/constants/callbacks';
import {PageType} from '@/constants/enums';
import Helpers from '@/helpers/index';

enum PixEvent {
  INITIATE_CHECKOUT = 'InitiateCheckout',
  LEAD = 'Lead',
  PURCHASE = 'Purchase',
}

enum PixParam {
  VALUE = 'value',
  CURRENCY = 'currency',
}

let fbqCheckoutCallbacks: CbCallbacksInterface = {
  [LOADED]() {
    window['fbq'] && window['fbq']('track', PixEvent.INITIATE_CHECKOUT);
  },

  [SUCCESS](hostedPageId, data) {
    let invoice = data && data.invoice;

    if (invoice) {
      let param: Object = {};
      param[PixParam.VALUE] = invoice && invoice.formatted_total;
      param[PixParam.CURRENCY] = invoice && invoice.currency_code;
      FBQ(PixEvent.PURCHASE, param);
    } else {
      FBQ(PixEvent.LEAD);
    }
  },
};

let FBQ = function (event: PixEvent, param?: object) {
  if (window['fbq']) {
    if (param) {
      window['fbq']('track', event, param);
    } else {
      window['fbq']('track', event);
    }
  }
};

/**@internal */
export default class FBQCallbacks {
  static get(pageType: PageType): CbCallbacksInterface {
    if (pageType == PageType.CHECKOUT && Helpers.getCbInstance().enableFBQTracking && window['fbq']) {
      return fbqCheckoutCallbacks;
    }
    return {};
  }
}
