import {ResponseInnerMessage} from '@/hosted_fields/common/types';
import '@/helpers/polyfills';
import ApplePayPluginInterface from '@/plugins/payments/apple_pay/actions/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import {PluginConfig} from '@/plugins/core/interface';
import ApplePayApis from '@/plugins/payments/apple_pay/api';
import CommManagerInterface from '@/hosted_fields/master/interface';
import {getPaymentIntentApiHeaders} from '@/internal/common/utils';

export default class ApplePayActions implements ApplePayPluginInterface {
  config: PluginConfig;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    this.apiClient.addApis(ApplePayApis);
    return Promise.resolve();
  }

  validateApplePaySession(data: any): Promise<ResponseInnerMessage> {
    return this.apiClient.apple_pay.validate_apple_pay_session({paymentIntentId: data.paymentIntentId}, data.payload, {
      headers: getPaymentIntentApiHeaders(data),
    });
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
  }
}
