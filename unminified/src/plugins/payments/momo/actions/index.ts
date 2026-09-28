import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import MomoPluginInterface from '@/plugins/payments/momo/actions/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import {PluginConfig} from '@/plugins/core/interface';
import MomoApis from '@/plugins/payments/momo/api';
import CommManagerInterface from '@/hosted_fields/master/interface';

export default class MomoActions implements MomoPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    this.apiClient.addApis(MomoApis);
    return Promise.resolve();
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
