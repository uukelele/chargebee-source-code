import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import KlarnaPluginInterface from '@/plugins/payments/klarna/actions/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import {PluginConfig} from '@/plugins/core/interface';
import KlarnaApis from '@/plugins/payments/klarna/api';
import CommManagerInterface from '@/hosted_fields/master/interface';

export default class KlarnaActions implements KlarnaPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    this.apiClient.addApis(KlarnaApis);
    return Promise.resolve();
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
