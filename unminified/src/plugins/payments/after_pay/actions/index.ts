import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import AfterpayPluginInterface from '@/plugins/payments/after_pay/actions/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import {PluginConfig} from '@/plugins/core/interface';
import AfterpayApis from '@/plugins/payments/after_pay/api';
import CommManagerInterface from '@/hosted_fields/master/interface';

export default class AfterpayActions implements AfterpayPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    this.apiClient.addApis(AfterpayApis);
    return Promise.resolve();
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
