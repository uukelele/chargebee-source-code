import PayNowHandler from '@/plugins/payments/paynow/handlers';
import {PayNowPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import PayNowPaymentLoaderInterface from '@/plugins/payments/paynow/loader/interface';

class PayNowLoader extends PluginLoader implements PayNowPaymentLoaderInterface {
  public static paynowHandler: PayNowHandler;

  init(): PayNowPayment {
    if (!PayNowLoader.paynowHandler) {
      PayNowLoader.paynowHandler = new PayNowHandler();
    }
    return PayNowLoader.paynowHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().paynowPaymentLoader = new PayNowLoader();
