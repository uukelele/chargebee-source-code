import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import DanaPluginInterface from './interface';
import {PluginConfig} from '@/plugins/core/interface';
import CommManagerInterface from '@/hosted_fields/master/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import DanaApis from '@/plugins/payments/dana/api';

export default class DanaActions implements DanaPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    this.apiClient.addApis(DanaApis);
    return Promise.resolve();
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
