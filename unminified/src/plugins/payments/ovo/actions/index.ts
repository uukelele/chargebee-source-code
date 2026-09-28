import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import OvoPluginInterface from '@/plugins/payments/ovo/actions/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import {PluginConfig} from '@/plugins/core/interface';
import OvoApis from '@/plugins/payments/ovo/api';
import CommManagerInterface from '@/hosted_fields/master/interface';

export default class OvoActions implements OvoPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    this.apiClient.addApis(OvoApis);
    return Promise.resolve();
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
