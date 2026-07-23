import {CbCallbacksInterface} from '@/interfaces/cb-types';
import {SUCCESS, LOADED} from '@/constants/callbacks';
import {PageType} from '@/constants/enums';
import Helpers from '@/helpers/index';

var loadFriendbuyScript = function () {
  (function (f, r, n, d, b, y) {
    (b = f.createElement(r)), (y = f.getElementsByTagName(r)[0]);
    b.async = 1;
    b.src = n;
    y.parentNode.insertBefore(b, y);
  })(document, 'script', '//djnf6e5yyirys.cloudfront.net/js/friendbuy.min.js');
};

let friendbuyCheckoutCallbacks: CbCallbacksInterface = {
  [SUCCESS](hostedPageId, data) {
    let friendbuyData = data.friendbuy && data.friendbuy.data;
    if (friendbuyData) {
      window['friendbuy'] = [];
      window['friendbuy'].push(['site', data.friendbuy.app_id]);
      window['friendbuy'].push([
        'track',
        'customer',
        {
          id: friendbuyData.customer.id,
          chargebee_customer_id: friendbuyData.customer.id,
          email: friendbuyData.customer.email,
          first_name: friendbuyData.customer.first_name,
          last_name: friendbuyData.customer.last_name,
        },
      ]);
      window['friendbuy'].push([
        'track',
        'order',
        {
          id: friendbuyData.subscription.id,
          amount: friendbuyData.invoice && friendbuyData.invoice.amount,
          email: friendbuyData.customer.email,
          coupon_code: friendbuyData.coupon_code,
        },
      ]);
    }

    if (data.friendbuy && data.friendbuy.widget_id) {
      let id = `friendbuy-${data.friendbuy.widget_id}`;
      if (document.getElementById(id)) {
        document.body.removeChild(document.getElementById(id));
      }
      let container = document.createElement('div');
      container.id = id;
      container.setAttribute('class', id);
      document.body.appendChild(container);
      window['friendbuy'].push(['widget', data.friendbuy.widget_id]);
    }
    loadFriendbuyScript();
    window.setTimeout(() => {
      Helpers.getCbInstance().closeAll();
    }, 2000);
  },
};

/**@internal */
export default class FriendbuyCallbacks {
  static get(pageType: PageType): CbCallbacksInterface {
    if (pageType == PageType.CHECKOUT && Helpers.getCbInstance().enableFriendbuyTracking) {
      return friendbuyCheckoutCallbacks;
    }
    return {};
  }
}
