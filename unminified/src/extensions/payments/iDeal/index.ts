import AbstractIDealHandler from '@/extensions/payments/iDeal/handlers/abstract';
import CbInstanceOptions from '@/interfaces/cb-instance-options';
import AdyenIDealHandler from '@/extensions/payments/iDeal/handlers/adyen';
import StripeIDealHandler from '@/extensions/payments/iDeal/handlers/stripe';
import DefaultIdealHandler from '@/extensions/payments/iDeal/handlers/default';
// TODO: REFACTOR, move common types out from 3DS and update imports
import {PaymentIntent, Options, Callbacks, Gateway} from '@/extensions/three_domain_secure/common/types';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {IDealPayment, ComponentType, PaymentOptions} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import {Master as M} from '@/hosted_fields/common/enums';
import Ids from '@/constants/ids';
import Helpers from '@/helpers';
import CbWindowManager from '@/models/cb-window-manager';
import {loadTranslations} from '@/helpers/translations';
import {Locale} from '@/hosted_fields/common/types';

export default class IDealHandler implements IDealPayment {
  public site: string;
  public paymentIntent: PaymentIntent;
  public options: Options;
  public component: any;
  public locale: Locale;

  private iDealHandler: AbstractIDealHandler;
  public windowManager: CbWindowManager;
  public isRedirectMode: boolean = false;

  constructor(options: CbInstanceOptions) {
    this.site = options.site;
    this.locale = options.locale;
  }

  setWindowManager(windowManager: CbWindowManager) {
    this.windowManager = windowManager;
  }

  setRedirectMode(val: boolean) {
    this.isRedirectMode = val;
  }

  validatePaymentIntent(intent: PaymentIntent): PaymentIntent {
    if (typeof intent !== 'object' || !(intent.id && intent.amount + '' && intent.status && intent.gateway))
      throw new CbError(Errors.invalidPaymentIntent);
    return intent;
  }

  mountBankList(id: string, options?: any): Promise<any> {
    if (!(options || options.currency)) {
      return Promise.reject(new CbError());
    }
    return loadTranslations(options.locale || this.locale).then(() => this.renderDefaultComponent(id, options));
  }

  renderDefaultComponent(id: string, options?: any): Promise<any> {
    const prevSelectedBank = this.component && this.component.getSelectedBank();
    const cbInstance = Helpers.getCbInstance();
    return cbInstance.loadComponent(ComponentType.IDeal, options).then((component) => {
      this.component = component;

      return component.mount(id).then(() => {
        return this.fetchGatewayDetails(options).then((res) => {
          const {gateway = '', ...details} = res;

          const gatewayName = gateway.toLowerCase();
          if (!this.iDealHandler) {
            this.iDealHandler = this.getIDealHandler(gatewayName);
          }
          switch (gatewayName) {
            case Gateway.ADYEN:
              let bankListObj;
              if (
                details.gateway_payment_method_meta.paymentMethod &&
                details.gateway_payment_method_meta.paymentMethod === 'ideal'
              ) {
                bankListObj = details.gateway_payment_method_meta.issuers;
              } else {
                const paymentDetails = details.gateway_payment_method_meta.find((obj) => obj.type === 'ideal');
                if (paymentDetails) {
                  const list = paymentDetails.details.find((obj) => obj.key === 'issuer' && obj.type === 'select');
                  bankListObj = list.items;
                }
              }
              if (bankListObj) {
                return IframeClientLoader.then((cbIframeClient) =>
                  cbIframeClient.send(
                    {
                      action: M.Actions.UpdateIDealBankList,
                      data: bankListObj,
                    },
                    Ids.MASTER_FRAME
                  )
                ).then((data) => {
                  if (prevSelectedBank) {
                    return IframeClientLoader.then((cbIframeClient) =>
                      cbIframeClient.send(
                        {
                          action: M.Actions.IDealBankSelected,
                          data: {
                            payload: prevSelectedBank,
                          },
                        },
                        Ids.MASTER_FRAME
                      )
                    );
                  }
                  return Promise.resolve(data);
                });
              }
              break;

            case Gateway.STRIPE:
              this.iDealHandler.setClientConfig(details);
              if (prevSelectedBank) {
                options = {
                  ...options,
                  bank: prevSelectedBank.id,
                };
              }
              this.iDealHandler.mountBankList(id, options);
              break;
            case Gateway.MOLLIE:
            case Gateway.CHECKOUT_COM:
              if (details.gateway_payment_method_meta.paymentMethod === 'ideal') {
                const bankListObj = details.gateway_payment_method_meta.issuers;

                return IframeClientLoader.then((cbIframeClient) =>
                  cbIframeClient.send(
                    {
                      action: M.Actions.UpdateIDealBankList,
                      data: bankListObj,
                    },
                    Ids.MASTER_FRAME
                  )
                ).then((data) => {
                  if (prevSelectedBank) {
                    return IframeClientLoader.then((cbIframeClient) =>
                      cbIframeClient.send(
                        {
                          action: M.Actions.IDealBankSelected,
                          data: {
                            payload: prevSelectedBank,
                          },
                        },
                        Ids.MASTER_FRAME
                      )
                    );
                  }
                  return Promise.resolve(data);
                });
              }
              break;
          }
        });
      });
    });
  }

  fetchGatewayDetails(options: any): Promise<any> {
    const currency = (options && options.currency) || (this.paymentIntent && this.paymentIntent.currency_code);

    if (!currency) {
      throw new CbError(Errors.missingIDealCurrency);
    }
    const reqData = {
      currency: currency,
      paymentMethodType: 'ideal',
    };
    const gatewayAccountId =
      (options && options.gateway_account_id) || (this.paymentIntent && this.paymentIntent.gateway_account_id);

    reqData['gatewayAccountId'] = gatewayAccountId;

    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.GetIDealGatewayDetails,
          data: reqData,
        },
        Ids.MASTER_FRAME,
        {timeout: 10000}
      )
    );
  }

  getSelectedBank(): any {
    return this.component && this.component.getSelectedBank();
  }

  handlePayment(options: PaymentOptions): Promise<any> {
    if (!options.paymentInfo || !options.paymentInfo.issuerBank) {
      const selectedBank = this.component && this.component.getSelectedBank();
      options.paymentInfo = {
        ...options.paymentInfo,
      };
      if (selectedBank) {
        options.paymentInfo.issuerBank = selectedBank.id;
      }
    }
    return options.paymentIntent().then((paymentIntent) => {
      this.paymentIntent = this.validatePaymentIntent(paymentIntent);
      if (!this.iDealHandler) {
        this.iDealHandler = this.getIDealHandler(paymentIntent.gateway);
      }
      return this.iDealHandler.handleIDealPayment(options.paymentInfo, options.callbacks);
    });
  }

  private getIDealHandler(gateway: Gateway): AbstractIDealHandler {
    switch (gateway) {
      case Gateway.ADYEN:
        return new AdyenIDealHandler(this);
      case Gateway.STRIPE:
        return new StripeIDealHandler(this);
      case Gateway.MOLLIE:
      case Gateway.CHECKOUT_COM:
        return new DefaultIdealHandler(this);
    }
  }
}
