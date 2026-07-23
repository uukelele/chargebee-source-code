import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import PaypayPluginInterface from './interface';
import {PluginConfig} from '../../../core/interface';
import CommManagerInterface from '../../../../hosted_fields/master/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import PaypayApis from '@/plugins/payments/paypay/api';

export default class PaypayActions implements PaypayPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    this.apiClient.addApis(PaypayApis);
    return Promise.resolve();
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
