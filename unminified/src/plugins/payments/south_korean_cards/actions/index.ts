import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import SouthKoreanCardsPluginInterface from '@/plugins/payments/south_korean_cards/actions/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import {PluginConfig} from '@/plugins/core/interface';
import SouthKoreanCardsApis from '@/plugins/payments/south_korean_cards/api';
import CommManagerInterface from '@/hosted_fields/master/interface';

export default class SouthKoreanCardsActions implements SouthKoreanCardsPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    this.apiClient.addApis(SouthKoreanCardsApis);
    return Promise.resolve();
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
