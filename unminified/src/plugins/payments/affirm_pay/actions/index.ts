import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import AffirmPluginInterface from '@/plugins/payments/affirm_pay/actions/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import {PluginConfig} from '@/plugins/core/interface';
import AffirmApis from '@/plugins/payments/affirm_pay/api';
import CommManagerInterface from '@/hosted_fields/master/interface';

export default class AffirmActions implements AffirmPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    this.apiClient.addApis(AffirmApis);
    return Promise.resolve();
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
