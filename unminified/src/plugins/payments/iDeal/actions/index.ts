import {ResponseInnerMessage} from '@/hosted_fields/common/types';
import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import IDealPluginInterface from '@/plugins/payments/iDeal/actions/interface';
import {ApiClientInterface} from '@/plugins/core/api/interface';
import {PluginConfig} from '@/plugins/core/interface';
import IDealApis from '@/plugins/payments/iDeal/api';
import CommManagerInterface from '@/hosted_fields/master/interface';
import {CbError} from '@/hosted_fields/common/errors';
import Logger from '@/utils/logger_old';
import {PaymentRedirectTimeouts} from '@/constants/enums';

export default class IDealActions implements IDealPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;
  private loadConfig: Promise<any>;
  private configuration: any;
  private apiClient: ApiClientInterface;
  private store: any;

  init(): Promise<void> {
    this.apiClient.addApis(IDealApis);
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

  setAdyenIDealVerificationResult(data: any): Promise<ResponseInnerMessage> {
    if (!this.store) this.store = {};
    this.store[data.paymentIntentId] = data;
    return Promise.resolve({acknowledged: true});
  }

  stopAdyenIDealPoll(data: any): Promise<ResponseInnerMessage> {
    if (!this.store) this.store = {};
    this.store[data.paymentIntentId] = data;
    return Promise.resolve({acknowledged: true});
  }

  pollAdyenIDealVerificationResult(data: any): Promise<ResponseInnerMessage> {
    return new Promise((resolve, reject) => {
      const paymentIntentId = data.paymentIntentId;
      let counter = 0;
      const intervalPeriod = 100;
      const targetCounter = PaymentRedirectTimeouts.IDEAL / intervalPeriod;

      const interval = setInterval(() => {
        // TODO throw proper error
        if (counter > targetCounter) {
          return reject({message: 'Poll Timeout'});
        }
        if (this.store && this.store[paymentIntentId]) {
          const _data: any = this.store[paymentIntentId];
          clearInterval(interval);

          // delete meta info passed
          delete _data.paymentIntentId;
          delete _data.src;

          delete this.store[paymentIntentId]; // clear result for reattempt

          if (_data.error) {
            return reject(_data);
          }
          return resolve(_data);
        }
        counter++;
      }, intervalPeriod);
    });
  }

  setStripeIDealVerificationResult(data: any): Promise<ResponseInnerMessage> {
    if (!this.store) this.store = {};
    this.store[data.paymentIntentId] = data;
    return Promise.resolve({acknowledged: true});
  }

  stopStripeIDealPoll(data: any): Promise<ResponseInnerMessage> {
    if (!this.store) this.store = {};
    this.store[data.paymentIntentId] = data;
    return Promise.resolve({acknowledged: true});
  }

  pollStripeIDealVerificationResult(data: any): Promise<ResponseInnerMessage> {
    return new Promise((resolve, reject) => {
      const paymentIntentId = data.paymentIntentId;
      let counter = 0;
      const intervalPeriod = 100;
      const targetCounter = PaymentRedirectTimeouts.IDEAL / intervalPeriod;

      const interval = setInterval(() => {
        // TODO throw proper error
        if (counter > targetCounter) {
          return reject({message: 'Poll Timeout'});
        }
        if (this.store && this.store[paymentIntentId]) {
          const _data: any = this.store[paymentIntentId];
          clearInterval(interval);

          // delete meta info passed
          delete _data.paymentIntentId;
          delete _data.src;

          delete this.store[paymentIntentId]; // clear result for reattempt

          if (_data.error) {
            return reject(_data);
          }
          return resolve(_data);
        }
        counter++;
      }, intervalPeriod);
    });
  }

  getIDealGatewayDetails(data: any): Promise<ResponseInnerMessage> {
    return this.apiClient.iDeal_config.get_gateway_details(null, data);
  }

  constructor(commMgr: CommManagerInterface) {
    this.apiClient = commMgr.apiClient;
    this.iframeClient = commMgr.connectionClient;
  }
}
