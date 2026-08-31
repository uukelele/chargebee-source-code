import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import QpayPluginInterface from './interface';
import {PluginConfig} from '@/plugins/core/interface';
import CommManagerInterface from '@/hosted_fields/master/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import QpayApis from '@/plugins/payments/qpay/api';

export default class QpayActions implements QpayPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    this.apiClient.addApis(QpayApis);
    return Promise.resolve();
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
