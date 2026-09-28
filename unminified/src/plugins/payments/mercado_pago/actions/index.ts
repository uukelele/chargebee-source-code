import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import MercadoPagoPluginInterface from '@/plugins/payments/mercado_pago/actions/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import {PluginConfig} from '@/plugins/core/interface';
import MercadoPagoApis from '@/plugins/payments/mercado_pago/api';
import CommManagerInterface from '@/hosted_fields/master/interface';

export default class MercadoPagoActions implements MercadoPagoPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    this.apiClient.addApis(MercadoPagoApis);
    return Promise.resolve();
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
