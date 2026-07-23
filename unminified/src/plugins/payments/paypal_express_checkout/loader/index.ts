import PaypalHandler from '@/plugins/payments/paypal_express_checkout/handlers';
import {PaypalPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import PaypalLoaderInterface from '@/plugins/payments/paypal_express_checkout/loader/interface';

class PaypalLoader extends PluginLoader implements PaypalLoaderInterface {
  public static paypalHandler: PaypalHandler;

  init(): PaypalPayment {
    if (!PaypalLoader.paypalHandler) {
      PaypalLoader.paypalHandler = new PaypalHandler();
    }
    return PaypalLoader.paypalHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().paypalPaymentLoader = new PaypalLoader();
