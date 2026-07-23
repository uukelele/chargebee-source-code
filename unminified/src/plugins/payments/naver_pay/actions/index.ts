import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import NaverPayPluginInterface from '@/plugins/payments/naver_pay/actions/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import {PluginConfig} from '@/plugins/core/interface';
import NaverPayApis from '@/plugins/payments/naver_pay/api';
import CommManagerInterface from '@/hosted_fields/master/interface';

export default class NaverPayActions implements NaverPayPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    this.apiClient.addApis(NaverPayApis);
    return Promise.resolve();
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
