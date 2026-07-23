import AmazonPayHandler from '@/plugins/payments/amazon_payments/handlers';
import {AmazonButtonOptions} from '../types';
import {loadScript} from '@/extensions/three_domain_secure/common/utils';
import {Master as M, Host as H} from '@/hosted_fields/common/enums';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import Ids from '@/constants/ids';
import Helpers from '@/helpers';
import {constructPaymentIntentApiPayload} from '@/internal/common/utils';

const AMAZON_JS_URL = 'https://static-na.payments-amazon.com/checkout.js';
let amazonpayhandler: AmazonPayHandler;

export default class AmazonDefaultHandler extends AmazonPayHandler {
  constructor(handler: AmazonPayHandler, ...args) {
    amazonpayhandler = handler;
    super(...args);
  }

  mountPaymentButton(
    id: string,
    options: AmazonButtonOptions = {
      locale: 'en_US',
      buttonColor: 'Gold',
      placement: 'Cart',
      productType: 'PayAndShip',
      chargePermissionType: 'Recurring',
    }
  ) {
    return Promise.all([loadScript(AMAZON_JS_URL, 'amazon'), this.generateButtonSignature()]).then(([_, gwData]) =>
      this.createAmazonBuyButton(gwData, id, options)
    );
  }

  private generateButtonSignature(): Promise<string> {
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.FetchAmazonPayButtonSignature,
          data: constructPaymentIntentApiPayload(this.getPaymentIntent()),
        },
        Ids.MASTER_FRAME,
        {timeout: 10000}
      )
    ).then((data: any) => {
      return data;
    });
  }

  createAmazonBuyButton(gwData, id, options) {
    const intent = this.getPaymentIntent();
    var amazonPayButton = window['amazon'].Pay.renderButton(id, {
      merchantId: gwData.merchantId,
      sandbox: Helpers.isTestSite(Helpers.getCbInstance().site),
      publicKeyId: gwData.publicKeyId,
      ledgerCurrency: gwData.ledgerCurrency,
      checkoutLanguage: options.locale,
      productType: options.productType,
      placement: gwData.placement,
      buttonColor: options.buttonColor,
    });

    amazonPayButton.onClick(() => {
      this.callbackHandler.triggerClickCallback();
      this.setWindowPopup();
      const data = {
        gwData,
        intent,
        sandbox: Helpers.isTestSite(Helpers.getCbInstance().site),
      };
      this.redirectToAmazonPay(data);
    });
  }
}
