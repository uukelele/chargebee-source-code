import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import TamaraPluginInterface from './interface';
import {PluginConfig} from '@/plugins/core/interface';
import CommManagerInterface from '@/hosted_fields/master/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import TamaraApis from '@/plugins/payments/tamara/api';

export default class TamaraActions implements TamaraPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    this.apiClient.addApis(TamaraApis);
    return Promise.resolve();
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
