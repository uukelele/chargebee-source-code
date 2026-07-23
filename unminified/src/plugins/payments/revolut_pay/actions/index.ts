import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import RevolutPayPluginInterface from '@/plugins/payments/revolut_pay/actions/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import {PluginConfig} from '@/plugins/core/interface';
import RevolutPayApis from '@/plugins/payments/revolut_pay/api';
import CommManagerInterface from '@/hosted_fields/master/interface';

export default class RevolutPayActions implements RevolutPayPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    this.apiClient.addApis(RevolutPayApis);
    return Promise.resolve();
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
