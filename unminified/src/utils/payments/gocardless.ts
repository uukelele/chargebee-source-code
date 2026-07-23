import Helpers from '@/helpers';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import Ids from '@/constants/ids';
import {Master as M} from '@/hosted_fields/common/enums';
import {ComponentType} from '@/hosted_fields/common/base-types';

export function loadDropDownComponent(type: ComponentType, options: any): any {
  return Helpers.getCbInstance().loadComponent(type, options);
}

export function updateDropDownComponent(response: any, prevSelectedBank: any): any {
  let bankList = response && response.gateway_payment_method_meta && response.gateway_payment_method_meta.issuers;
  if (bankList) {
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.UpdateIDealBankList,
          data: bankList,
        },
        Ids.MASTER_FRAME
      )
    ).then((data) => {
      if (bankList.find((b) => b.id == prevSelectedBank && prevSelectedBank.id) > -1) {
        return IframeClientLoader.then((cbIframeClient) =>
          cbIframeClient.send(
            {
              action: M.Actions.IDealBankSelected,
              data: {
                payload: prevSelectedBank,
              },
            },
            Ids.MASTER_FRAME
          )
        );
      }
      return Promise.resolve(data);
    });
  }
}
