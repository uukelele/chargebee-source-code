import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import PayCoPluginInterface from '@/plugins/payments/pay_co/actions/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import {PluginConfig} from '@/plugins/core/interface';
import PayCoApis from '@/plugins/payments/pay_co/api';
import CommManagerInterface from '@/hosted_fields/master/interface';

export default class PayCoActions implements PayCoPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    this.apiClient.addApis(PayCoApis);
    return Promise.resolve();
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
