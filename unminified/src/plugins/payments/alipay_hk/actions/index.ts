import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import AlipayHkPluginInterface from '@/plugins/payments/alipay_hk/actions/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import {PluginConfig} from '@/plugins/core/interface';
import AlipayHkApis from '@/plugins/payments/alipay_hk/api';
import CommManagerInterface from '@/hosted_fields/master/interface';

export default class AlipayHkActions implements AlipayHkPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    this.apiClient.addApis(AlipayHkApis);
    return Promise.resolve();
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
