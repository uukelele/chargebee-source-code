import {CbCallbacksInterface} from '@/interfaces/cb-types';
import {PAGE_VISITED, CLOSE, SUCCESS, ERROR, LOADED, CHECKOUT_STEP} from '@/constants/callbacks';
import {PageType} from '@/constants/enums';
import Helpers from '@/helpers/index';
import GoogleAnalyticsTracking, {GAIntegrationType} from '@/utils/logger/GoogleAnalyticsTracking';

type product = {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity?: number;
  list_name: string;
};

let gtmCheckoutCallbacks: CbCallbacksInterface = {
  [LOADED](page: string) {
    DataLayerPushEvent('begin_checkout', 'ecommerce');
  },

  [CHECKOUT_STEP](page: string) {
    DataLayerPushEvent(page, 'cb-checkout');
  },

  [SUCCESS](hostedPageId, data) {
    let invoice = data && data.invoice;
    if (invoice) {
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
      let ecommerceData = <object>{
        currencyCode: invoice.currency_code,
        purchase: {
          actionField: {
            id: hostedPageId,
            revenue: invoice.formatted_total,
            tax: invoice.tax,
          },
          products: transactionProducts,
        },
      };
      DataLayerPushPurchase('chargebee_ecommerce', ecommerceData);
    } else {
      DataLayerPushEvent('lead', 'engagement');
    }
  },
};

let gtmPortalCallbacks: CbCallbacksInterface = {
  [PAGE_VISITED](page: string) {
    DataLayerPushEvent(page, 'cb-portal');
  },
};

let DataLayerPushEvent = function (action: string, category: string) {
  DataLayerCustomEventPush('cb_event', action, category);
};

let DataLayerPushPurchase = function (eventName: string, ecommerceData: object) {
  if (window['dataLayer']) {
    window['dataLayer'].push({
      event: eventName,
      ecommerce: ecommerceData,
    });
  }
  GoogleAnalyticsTracking.log(eventName, 'purchase', GAIntegrationType.GOOGLE_TAG_MANAGER);
};

let DataLayerCustomEventPush = function (event: string, action: string, category: string) {
  if (window['dataLayer']) {
    window['dataLayer'].push({
      event: event,
      cbAction: action,
      cbCategory: category,
    });
  }
  GoogleAnalyticsTracking.log(action, category, GAIntegrationType.GOOGLE_TAG_MANAGER);
};

/**@internal */
export default class GTMCallbacks {
  static get(pageType: PageType): CbCallbacksInterface {
    if (Helpers.getCbInstance().enableGTMTracking && window['dataLayer']) {
      if (pageType == PageType.CHECKOUT) {
        return gtmCheckoutCallbacks;
      } else {
        return gtmPortalCallbacks;
      }
    }
    return {};
  }
}
