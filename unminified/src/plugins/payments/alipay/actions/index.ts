import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import AlipayPluginInterface from '@/plugins/payments/alipay/actions/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import {PluginConfig} from '@/plugins/core/interface';
import AlipayApis from '@/plugins/payments/alipay/api';
import CommManagerInterface from '@/hosted_fields/master/interface';

export default class AlipayActions implements AlipayPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    this.apiClient.addApis(AlipayApis);
    return Promise.resolve();
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
