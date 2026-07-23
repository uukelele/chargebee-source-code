import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import ElectronicPaymentStandardPluginInterface from '@/plugins/payments/electronic_payment_standard/actions/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import {PluginConfig} from '@/plugins/core/interface';
import ElectronicPaymentStandardApis from '@/plugins/payments/electronic_payment_standard/api';
import CommManagerInterface from '@/hosted_fields/master/interface';

export default class ElectronicPaymentStandardActions implements ElectronicPaymentStandardPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    this.apiClient.addApis(ElectronicPaymentStandardApis);
    return Promise.resolve();
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
