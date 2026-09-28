import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import NequiPluginInterface from '@/plugins/payments/nequi/actions/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import {PluginConfig} from '@/plugins/core/interface';
import NequiApis from '@/plugins/payments/nequi/api';
import CommManagerInterface from '@/hosted_fields/master/interface';

export default class NequiActions implements NequiPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    this.apiClient.addApis(NequiApis);
    return Promise.resolve();
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
