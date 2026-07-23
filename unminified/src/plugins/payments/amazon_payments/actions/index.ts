import '@/helpers/polyfills';
import AmazonPayPluginInterface from '@/plugins/payments/amazon_payments/actions/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import {PluginConfig} from '@/plugins/core/interface';
import AmazonPayApis from '@/plugins/payments/amazon_payments/api';
import CommManagerInterface from '@/hosted_fields/master/interface';
import {ResponseInnerMessage} from '@/hosted_fields/common/types';

import {getPaymentIntentApiHeaders} from '@/internal/common/utils';

export default class AmazonPayActions implements AmazonPayPluginInterface {
  config: PluginConfig;
  private apiClient: ApiClientInterface;

  init(): Promise<void> {
    this.apiClient.addApis(AmazonPayApis);
    return Promise.resolve();
  }

  generateAmazonPayButtonSignature(data: any): Promise<ResponseInnerMessage> {
    return this.apiClient.amazon_payments.generate_amazon_pay_button_signature(
      {paymentIntentId: data.paymentIntentId},
      data.payload,
      {headers: getPaymentIntentApiHeaders(data)}
    );
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
  }
}
