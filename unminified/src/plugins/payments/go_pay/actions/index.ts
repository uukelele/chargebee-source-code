import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import GoPayPluginInterface from '@/plugins/payments/go_pay/actions/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import {PluginConfig} from '@/plugins/core/interface';
import GoPayApis from '@/plugins/payments/go_pay/api';
import CommManagerInterface from '@/hosted_fields/master/interface';

export default class GoPayActions implements GoPayPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    this.apiClient.addApis(GoPayApis);
    return Promise.resolve();
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
