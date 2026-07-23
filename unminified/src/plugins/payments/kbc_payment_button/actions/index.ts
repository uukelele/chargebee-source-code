import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import KbcPaymentButtonPluginInterface from '@/plugins/payments/kbc_payment_button/actions/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import {PluginConfig} from '@/plugins/core/interface';
import KbcPaymentButtonApis from '@/plugins/payments/kbc_payment_button/api';
import CommManagerInterface from '@/hosted_fields/master/interface';

export default class KbcPaymentButtonActions implements KbcPaymentButtonPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    this.apiClient.addApis(KbcPaymentButtonApis);
    return Promise.resolve();
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
