import AbstractDotpayHandler from '@/plugins/payments/dotpay/handlers/abstract';
import CbInstanceOptions from '@/interfaces/cb-instance-options';
import AdyenDotpayHandler from '@/plugins/payments/dotpay/handlers/adyen';
// TODO: REFACTOR, move common types out from 3DS and update imports
import {PaymentIntent, Options, Callbacks, Gateway} from '@/extensions/three_domain_secure/common/types';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {DotpayPayment, PaymentOptions, ComponentType} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import CbWindowManager from '@/models/cb-window-manager';
import Helpers from '@/helpers';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import Ids from '@/constants/ids';
import {Master as M} from '@/hosted_fields/common/enums';
import {loadTranslations} from '@/helpers/translations';
import {PaymentInfo} from '../../iDeal/types';

export default class DotpayHandler implements DotpayPayment {
  public site: string;
  public paymentIntent: PaymentIntent;
  public options: Options;
  public component: any;

  private dotpayHandler: AbstractDotpayHandler;
  public windowManager: CbWindowManager;
  public isRedirectMode: boolean = false;

  constructor(chargebee: CbInstanceOptions) {
    this.site = chargebee.site;
  }

  setWindowManager(windowManager: CbWindowManager) {
    this.windowManager = windowManager;
  }

  setRedirectMode(val: boolean) {
    this.isRedirectMode = val;
  }

  mountBankList(id: string, options?: any): Promise<any> {
    if (!(options || options.currency)) {
      return Promise.reject(new CbError());
    }

    if (options.locale) loadTranslations(options.locale);
    return this.renderDefaultComponent(id, options);
  }

  renderDefaultComponent(id: string, options?: any): Promise<any> {
    const prevSelectedBank = this.component && this.component.getSelectedBank();
    const cbInstance = Helpers.getCbInstance();
    return cbInstance.loadComponent(ComponentType.Dotpay, options).then((component) => {
      this.component = component;
      return component.mount(id).then(() => {
        return this.fetchGatewayDetails(options).then((res) => {
          const {gateway = '', ...details} = res;

          const gatewayName = gateway.toLowerCase();
          if (!this.dotpayHandler) {
            this.dotpayHandler = this.getDotpayHandler(gatewayName);
          }

          switch (gatewayName) {
            case Gateway.ADYEN:
              let bankListObj;
              if (
                details.gateway_payment_method_meta.paymentMethod != null &&
                details.gateway_payment_method_meta.paymentMethod !== undefined &&
                details.gateway_payment_method_meta.paymentMethod === 'dotpay'
              ) {
                bankListObj = details.gateway_payment_method_meta.issuers;
              } else {
                const paymentDetails = details.gateway_payment_method_meta.find((obj) => obj.type === 'dotpay');
                if (paymentDetails) {
                  let list = paymentDetails.details.find((obj) => obj.key === 'issuer' && obj.type === 'select');
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
          }
        });
      });
    });
  }

  fetchGatewayDetails(options: any): Promise<any> {
    const currency = (options && options.currency) || (this.paymentIntent && this.paymentIntent.currency_code);

    if (!currency) {
      throw new CbError(Errors.missingDotpayCurrency);
    }
    const reqData = {
      currency: currency,
      paymentMethodType: 'dotpay',
    };
    const gatewayAccountId =
      (options && options.gateway_account_id) || (this.paymentIntent && this.paymentIntent.gateway_account_id);

    reqData['gatewayAccountId'] = gatewayAccountId;

    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.GetDotpayGatewayDetails,
          data: reqData,
        },
        Ids.MASTER_FRAME,
        {timeout: 10000}
      )
    );
  }

  getSelectedBank(): any {
    return this.component.getSelectedBank();
  }

  validatePaymentIntent(intent: PaymentIntent): PaymentIntent {
    if (typeof intent !== 'object' || !(intent.id && intent.amount + '' && intent.status && intent.gateway))
      throw new CbError(Errors.invalidPaymentIntent);
    return intent;
  }

  handlePayment(options: PaymentOptions): Promise<any> {
    let paymentInfo = options.paymentInfo;
    if (!(paymentInfo && paymentInfo.issuerBank)) {
      const selectedBank = this.component.getSelectedBank();
      if (selectedBank) {
        paymentInfo = {
          issuerBank: selectedBank.id,
        };
      } else {
        return Promise.reject(new CbError(Errors.missingDotpayIssuerBank));
      }
    }
    return options.paymentIntent().then((paymentIntent) => {
      this.paymentIntent = this.validatePaymentIntent(paymentIntent);
      if (!this.dotpayHandler) {
        this.dotpayHandler = this.getDotpayHandler(paymentIntent.gateway);
      }
      return this.dotpayHandler.handleDotpayPayment(paymentInfo as PaymentInfo, options.callbacks);
    });
  }

  private getDotpayHandler(gateway: Gateway): AbstractDotpayHandler {
    switch (gateway) {
      case Gateway.ADYEN:
        return new AdyenDotpayHandler(this);
    }
  }
}
