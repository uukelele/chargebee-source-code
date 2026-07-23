import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import PayByBankPluginInterface from '@/plugins/payments/pay_by_bank/actions/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import {PluginConfig} from '@/plugins/core/interface';
import PayByBankApis from '@/plugins/payments/pay_by_bank/api';
import CommManagerInterface from '@/hosted_fields/master/interface';

export default class PayByBankActions implements PayByBankPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    this.apiClient.addApis(PayByBankApis);
    return Promise.resolve();
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
