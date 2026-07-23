import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import StablecoinPluginInterface from '@/plugins/payments/stablecoin/actions/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import {PluginConfig} from '@/plugins/core/interface';
import StablecoinApis from '@/plugins/payments/stablecoin/api';
import CommManagerInterface from '@/hosted_fields/master/interface';

export default class StablecoinActions implements StablecoinPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    this.apiClient.addApis(StablecoinApis);
    return Promise.resolve();
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
