import {CbCallbacksInterface} from '@/interfaces/cb-types';
import {PAGE_VISITED, CLOSE, SUCCESS, ERROR, LOADED, CHECKOUT_STEP} from '@/constants/callbacks';
import {PageType} from '@/constants/enums';
import Helpers from '@/helpers/index';
import GoogleAnalyticsTracking, {GAIntegrationType} from '@/utils/logger/GoogleAnalyticsTracking';

/**
 * Google Analytics Standard Events
 * https://developers.google.com/analytics/devguides/collection/gtagjs/events
 */

type event = {
  action: string;
  category: string;
};

type product = {
  name: string;
  category: string;
  price: number;
  quantity?: number;
};

const GAEvent = {
  BEGIN_CHECKOUT: <event>{action: 'begin_checkout', category: 'ecommerce'},
  LEAD: <event>{action: 'generate_lead', category: 'engagement'},
  PURCHASE: <event>{action: 'purchase', category: 'ecommerce'},
};

let _resolvePurchaseAck: (() => void) | null = null;
let _purchaseAckPromise: Promise<void> | null = null;
let _purchaseEventFiredAt: number | null = null;

/**
 * Returns a Promise that resolves when gtag's event_callback fires for the
 * purchase event, or null if no purchase event has been sent yet.
 * The redirect code can race this against a timeout fallback.
 */
export function getGAPurchaseAckPromise(): Promise<void> | null {
  return _purchaseAckPromise;
}

export function getPurchaseEventFiredAt(): number | null {
  return _purchaseEventFiredAt;
}

enum GAParam {
  TRANSACTION_ID = 'transaction_id',
  VALUE = 'value',
  CURRENCY = 'currency',
  TAX = 'tax',
  TRANSACTION_PRODUCTS = 'items',
}

let gaCheckoutCallbacks: CbCallbacksInterface = {
  [LOADED]() {
    GATag(GAEvent.BEGIN_CHECKOUT);
  },

  [CHECKOUT_STEP](page: string) {
    GATagCustom('cb-checkout', page);
  },

  [SUCCESS](hostedPageId, data) {
    let invoice = data && data.invoice;

    if (invoice) {
      let param: Object = {};
      let transactionProducts: Array<product> = [];
      invoice.line_items.forEach((lineItem) => {
        let item = <product>{
          id: lineItem.entity_id,
          name: lineItem.entity_id,
          list_name: 'Chargebee checkout',
          category: lineItem.entity_type,
          price: lineItem.unit_amount,
          quantity: lineItem.quantity,
        };
        transactionProducts = transactionProducts.concat(item);
      });

      param[GAParam.TRANSACTION_ID] = hostedPageId;
      param[GAParam.VALUE] = invoice && invoice.formatted_total;
      param[GAParam.CURRENCY] = invoice && invoice.currency_code;
      param[GAParam.TAX] = invoice && invoice.tax;
      param[GAParam.TRANSACTION_PRODUCTS] = transactionProducts;

      _purchaseEventFiredAt = Date.now();
      _purchaseAckPromise = new Promise<void>((resolve) => {
        _resolvePurchaseAck = resolve;
      });
      param['event_callback'] = function () {
        if (_resolvePurchaseAck) {
          _resolvePurchaseAck();
          _resolvePurchaseAck = null;
        }
      };

      GATag(GAEvent.PURCHASE, param);
    } else {
      GATag(GAEvent.LEAD);
    }
  },
};

let gaPortalCallbacks: CbCallbacksInterface = {
  [PAGE_VISITED](page: string) {
    GATagCustom('cb-portal', page);
  },
};

/**
 * Google Analytics Action Data
 * https://developers.google.com/analytics/devguides/collection/gtagjs/enhanced-ecommerce
 */

let GATag = function (e: event, gTagActionData?: object) {
  if (window['gtag']) {
    if (gTagActionData) {
      window['gtag']('event', e.action, gTagActionData);
    } else {
      window['gtag']('event', e.action);
    }
  } else if (window['ga']) {
    window['ga']('send', 'event', e.category, e.action);
  }
  GoogleAnalyticsTracking.log(e.action, e.category, GAIntegrationType.GOOGLE_ANALYTICS);
};

let GATagCustom = function (category: string, action: string) {
  if (window['gtag']) {
    window['gtag']('event', action, {event_category: category});
  } else if (window['ga']) {
    window['ga']('send', 'event', category, action);
  }
};

/**@internal */
export default class GACallbacks {
  static get(pageType: PageType): CbCallbacksInterface {
    if (Helpers.getCbInstance().enableGATracking && (window['ga'] || window['gtag'])) {
      if (pageType == PageType.CHECKOUT) {
        return gaCheckoutCallbacks;
      } else {
        return gaPortalCallbacks;
      }
    }
    return {};
  }
}
