import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import GcashPluginInterface from '@/plugins/payments/gcash/actions/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import {PluginConfig} from '@/plugins/core/interface';
import GcashApis from '@/plugins/payments/gcash/api';
import CommManagerInterface from '@/hosted_fields/master/interface';

export default class GcashActions implements GcashPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    this.apiClient.addApis(GcashApis);
    return Promise.resolve();
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
