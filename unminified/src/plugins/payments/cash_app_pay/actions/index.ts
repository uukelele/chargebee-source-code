import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import CashAppPayPluginInterface from '@/plugins/payments/cash_app_pay/actions/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import {PluginConfig} from '@/plugins/core/interface';
import CashAppPayApis from '@/plugins/payments/cash_app_pay/api';
import CommManagerInterface from '@/hosted_fields/master/interface';

export default class CashAppPayActions implements CashAppPayPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    this.apiClient.addApis(CashAppPayApis);
    return Promise.resolve();
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
