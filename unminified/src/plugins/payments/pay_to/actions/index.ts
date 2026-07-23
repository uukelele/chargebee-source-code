import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import PayToPluginInterface from '@/plugins/payments/pay_to/actions/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import {PluginConfig} from '@/plugins/core/interface';
import PayToApis from '@/plugins/payments/pay_to/api';
import CommManagerInterface from '@/hosted_fields/master/interface';
import {CbError} from '@/hosted_fields/common/errors';
import Logger from '@/utils/logger_old';
import {ResponseInnerMessage} from '@/hosted_fields/common/types';

export default class PayToActions implements PayToPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private loadConfig: Promise<any>;
  private configuration: any;
  private apiClient: ApiClientInterface;
  private store: any;

  init(): Promise<void> {
    this.apiClient.addApis(PayToApis);
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

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }

  getPayToGatewayDetails(data: any): Promise<ResponseInnerMessage> {
    return this.apiClient.pay_to_config.get_gateway_details(null, data);
  }
}
