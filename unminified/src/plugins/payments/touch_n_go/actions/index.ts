import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import TouchNGoPluginInterface from './interface';
import {PluginConfig} from '@/plugins/core/interface';
import CommManagerInterface from '@/hosted_fields/master/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import TouchNGoApis from '@/plugins/payments/touch_n_go/api';

export default class TouchNGoActions implements TouchNGoPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    this.apiClient.addApis(TouchNGoApis);
    return Promise.resolve();
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
