import {PaypalPayment} from '@/hosted_fields/common/base-types';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {PaymentMethodType, Callbacks, PaymentIntent} from '@/internal/payment-intent/types';
import {Options, ButtonStyle} from '../types';
import {loadScriptUsingPredicate} from '@/extensions/three_domain_secure/common/utils';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import Ids from '@/constants/ids';
import {Master as M} from '@/hosted_fields/common/enums';
import Helpers from '@/helpers/index';

export default class PaypalHandler extends PaymentIntentHandler implements PaypalPayment {
  private static gatewayHandlerCache: Record<string, any> = {};
  constructor(...args) {
    super(...args);
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.PAYPAL_EXPRESS_CHECKOUT,
    });
  }

  async mountPaymentButton(id: string, options: Options = {}): Promise<any> {
    options.style = Object.assign(this.getPaypalStyles(), options.style);
    const gatewayHandlerKey =
      this.getPaymentIntent().id + this.getPaymentIntent().gateway_account_id + this.getPaymentIntent().currency_code;
    if (PaypalHandler.gatewayHandlerCache[gatewayHandlerKey]) {
      this.gatewayHandler = PaypalHandler.gatewayHandlerCache[gatewayHandlerKey];
      this.gatewayHandler.setPaymentIntent(this.getPaymentIntent());
    } else {
      this.gatewayHandler = await this.getGatewayHandler(this.getPaymentIntent());
      PaypalHandler.gatewayHandlerCache[gatewayHandlerKey] = this.gatewayHandler;
    }
    // initializing just to handle error during button mount
    const isCbCheckout = Helpers.getCbInstance().options.forCbCheckout;
    if (!isCbCheckout) {
      // this method is pushing a state in route so adding !isCbCheckout so that it won't push any state
      // and we are not using callbacks in checkout so it won't cause any issue
      this.gatewayHandler.initCallbacks({}, {});
    }
    return this.gatewayHandler.mountPaymentButton(id, options);
  }

  handlePayment(callbacks: Callbacks): Promise<PaymentIntent> {
    return this.gatewayHandler.handlePayment(callbacks);
  }

  getPaypalStyles(): ButtonStyle {
    return {
      size: 'medium',
      color: 'gold',
      shape: 'rect',
      label: 'paypal',
      tagline: false,
    };
  }

  paypal() {
    return window['paypal'];
  }

  async handleClick(data, actions) {
    return new Promise(async (resolve, reject) => {
      try {
        await this.callbackHandler.triggerClickCallback();
        if (actions && actions.resolve) {
          return resolve(actions.resolve());
        }
        resolve(null);
      } catch (err) {
        this.callbackHandler.triggerErrorCallback(err);
        if (actions && actions.reject) {
          return resolve(actions.reject());
        }
        reject(err);
      }
    });
  }

  loadPaypalJS(): Promise<any> {
    if (!(this.paypal() && this.paypal().Button)) {
      return loadScriptUsingPredicate(
        'https://www.paypalobjects.com/api/checkout.min.js',
        () => !!(this.paypal() && this.paypal().Button)
      );
    }
    return Promise.resolve(true);
  }

  protected kvl(data): Promise<any> {
    const payload = {
      ...data,
      ...{site_meta: Helpers.getSiteMetaData()},
    };
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.CaptureKVL,
          data: payload,
        },
        Ids.MASTER_FRAME
      )
    );
  }
}
