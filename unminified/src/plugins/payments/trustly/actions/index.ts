import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import TrustlyPluginInterface from '@/plugins/payments/trustly/actions/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import {PluginConfig} from '@/plugins/core/interface';
import TrustlyApis from '@/plugins/payments/trustly/api';
import CommManagerInterface from '@/hosted_fields/master/interface';

export default class TrustlyActions implements TrustlyPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    this.apiClient.addApis(TrustlyApis);
    return Promise.resolve();
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
