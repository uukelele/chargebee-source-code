import Ids from '@/constants/ids';
import {ResponseInnerMessage} from '@/hosted_fields/common/types';
const IframeClientLoader = import(/* webpackChunkName: "iframe-client" */ '@/hosted_fields/host/cb-iframe-client').then(
  (cbIframeClient: any) => cbIframeClient.default
);

export default IframeClientLoader;

export const sendToMasterIframe = (action, data?, options: any = {}): Promise<ResponseInnerMessage> => {
  return IframeClientLoader.then((cbIframeClient) =>
    cbIframeClient.send(
      {
        action,
        data,
      },
      Ids.MASTER_FRAME,
      {timeout: options.timeout || 10000}
    )
  );
};
