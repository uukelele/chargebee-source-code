import CbIframeManager from '@/models/cb-iframe-manager';
import CbInstance from '@/models/cb-instance';
import Ids from '@/constants/ids';
import Urls from '@/models/urls';
import {PortalSession} from '@/interfaces/cb-types';
import {State} from '@/constants/enums';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import {Master} from '@/hosted_fields/common/enums';

export default class AuthHandler {
  cbInstance: CbInstance;
  ssoToken: PortalSession | string;
  ssoTokenFetcher: () => Promise<PortalSession>;
  state: State;

  constructor(cbInstance: CbInstance) {
    this.cbInstance = cbInstance;
  }

  setSsoToken(token: string): void {
    this.ssoToken = token;
  }

  setSsoTokenFetcher(func: () => Promise<PortalSession>): void {
    this.ssoTokenFetcher = func;
  }

  logout(): void {
    IframeClientLoader.then((iframeClient) =>
      iframeClient.send(
        {
          action: Master.Actions.PortalLogout,
        },
        Ids.MASTER_FRAME
      )
    );
    this.reset();
  }

  close(customerId: string) {
    this.state = State.AUTHENTICATED;
    this.cbInstance.authenticated = true;
  }

  reset() {
    this.state = undefined;
    this.cbInstance.authenticated = false;
  }
}
