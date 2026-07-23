import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import BoletoPluginInterface from '@/plugins/payments/boleto/actions/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import {PluginConfig} from '@/plugins/core/interface';
import CommManagerInterface from '@/hosted_fields/master/interface';

export default class BoletoActions implements BoletoPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    return Promise.resolve();
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
