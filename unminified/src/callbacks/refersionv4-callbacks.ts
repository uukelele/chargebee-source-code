import {CbCallbacksInterface} from '@/interfaces/cb-types';
import {SUCCESS} from '@/constants/callbacks';
import {PageType} from '@/constants/enums';
import Helpers from '@/helpers/index';
import Ids from '@/constants/ids';
import {jsonify} from '@/utils/utility-functions';
import {Master as M} from '@/hosted_fields/common/enums';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';

let refersionCheckoutCallbacksV4: CbCallbacksInterface = {
  [SUCCESS](hostedPageId, data) {
    let r = window['r'];
    let subData = data && data.subscription;

    if (subData && r && typeof r.sendCheckoutEvent === 'function') {
      let id = '',
        aid = '',
        cs = '',
        cart = subData.id,
        url = window.location.href;

      try {
        id = window.localStorage.getItem('rfsn_v4_id');
        aid = window.localStorage.getItem('rfsn_v4_aid');
        cs = window.localStorage.getItem('rfsn_v4_cs');
        if (id && aid && cs) {
          r.sendCheckoutEvent(cart, id, url, aid, cs);
        } else {
          return IframeClientLoader.then((cbIframeClient) =>
            cbIframeClient.send(
              {
                action: M.Actions.CaptureException,
                data: {error: {name: 'Error', message: 'Missing refersion parameters'}},
              },
              Ids.MASTER_FRAME
            )
          );
        }
      } catch (error) {
        return IframeClientLoader.then((cbIframeClient) =>
          cbIframeClient.send(
            {
              action: M.Actions.CaptureException,
              data: {error: jsonify(error)},
            },
            Ids.MASTER_FRAME
          )
        );
      }
    }
  },
};

/**@internal */
export default class RefersionCallbacksV4 {
  static get(pageType: PageType): CbCallbacksInterface {
    if (pageType === PageType.CHECKOUT && Helpers.getCbInstance().enableRefersionTracking && window['r']) {
      return refersionCheckoutCallbacksV4;
    }
    return {};
  }
}
