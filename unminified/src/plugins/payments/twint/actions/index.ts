import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import TwintPluginInterface from '@/plugins/payments/twint/actions/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import {PluginConfig} from '@/plugins/core/interface';
import TwintApis from '@/plugins/payments/twint/api';
import CommManagerInterface from '@/hosted_fields/master/interface';

export default class TwintActions implements TwintPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    this.apiClient.addApis(TwintApis);
    return Promise.resolve();
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
