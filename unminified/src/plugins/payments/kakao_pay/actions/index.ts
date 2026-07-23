import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import KakaoPayPluginInterface from '@/plugins/payments/kakao_pay/actions/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import {PluginConfig} from '@/plugins/core/interface';
import KakaoPayApis from '@/plugins/payments/kakao_pay/api';
import CommManagerInterface from '@/hosted_fields/master/interface';

export default class KakaoPayActions implements KakaoPayPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    this.apiClient.addApis(KakaoPayApis);
    return Promise.resolve();
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
