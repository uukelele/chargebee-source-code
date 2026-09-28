import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import NupayPluginInterface from '@/plugins/payments/nupay/actions/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import {PluginConfig} from '@/plugins/core/interface';
import NupayApis from '@/plugins/payments/nupay/api';
import CommManagerInterface from '@/hosted_fields/master/interface';

export default class NupayActions implements NupayPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    this.apiClient.addApis(NupayApis);
    return Promise.resolve();
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
