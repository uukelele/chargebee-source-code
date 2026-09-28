import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import RakutenPayPluginInterface from '@/plugins/payments/rakuten_pay/actions/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import {PluginConfig} from '@/plugins/core/interface';
import RakutenPayApis from '@/plugins/payments/rakuten_pay/api';
import CommManagerInterface from '@/hosted_fields/master/interface';

export default class RakutenPayActions implements RakutenPayPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    this.apiClient.addApis(RakutenPayApis);
    return Promise.resolve();
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
