import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import PicpayPluginInterface from '@/plugins/payments/picpay/actions/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import {PluginConfig} from '@/plugins/core/interface';
import PicpayApis from '@/plugins/payments/picpay/api';
import CommManagerInterface from '@/hosted_fields/master/interface';

export default class PicpayActions implements PicpayPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    this.apiClient.addApis(PicpayApis);
    return Promise.resolve();
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
