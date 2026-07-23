import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import Ids from '@/constants/ids';
import {Master as M} from '@/hosted_fields/common/enums';
import {constructPaymentIntentApiPayload} from '@/internal/common/utils';

export function fetchGatewayCredential(paymentIntent): Promise<any> {
  return IframeClientLoader.then((cbIframeClient) =>
    cbIframeClient.send(
      {
        action: M.Actions.FetchGatewayCredential,
        data: {...constructPaymentIntentApiPayload(paymentIntent), origin: window.location.origin},
      },
      Ids.MASTER_FRAME,
      {timeout: 10000}
    )
  );
}
