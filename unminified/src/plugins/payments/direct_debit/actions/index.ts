import {ResponseInnerMessage} from '@/hosted_fields/common/types';
import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import DirectDebitPluginInterface from '@/plugins/payments/direct_debit/actions/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import {PluginConfig} from '@/plugins/core/interface';
import DirectDebitApis from '@/plugins/payments/direct_debit/api';
import CommManagerInterface from '@/hosted_fields/master/interface';
import {CbError} from '@/hosted_fields/common/errors';
import Logger from '@/utils/logger_old';
import {PaymentRedirectTimeouts} from '@/constants/enums';
import {getPaymentIntentApiHeaders} from '@/internal/common/utils';

export default class DirectDebitActions implements DirectDebitPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private loadConfig: Promise<any>;
  private configuration: any;
  private apiClient: ApiClientInterface;
  private store: any;

  init(): Promise<void> {
    this.apiClient.addApis(DirectDebitApis);
    if (this.apiClient._config.publishableKey) {
      this.loadConfig = this.apiClient.config
        .retrieve()
        .then((config) => {
          this.configuration = config;
        })
        .catch((error) => {
          const err = new CbError(error);
          Logger.error(err);
          throw err;
        });
    } else {
      this.loadConfig = Promise.resolve(true);
    }
    return Promise.resolve();
  }

  fetchPlaidLinkToken(data: any): Promise<ResponseInnerMessage> {
    return this.apiClient.plaid_config.get_link_token({paymentIntentId: data.paymentIntentId}, data, {
      headers: getPaymentIntentApiHeaders(data),
    });
  }

  fetchGWPaymentMethodConfig(data: any): Promise<ResponseInnerMessage> {
    return this.apiClient.plaid_config.get_gw_payment_method_config(
      {paymentIntentId: data.paymentIntentId},
      {},
      {headers: getPaymentIntentApiHeaders(data)}
    );
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
