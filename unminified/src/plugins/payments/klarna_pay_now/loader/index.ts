import KlarnaPayNowHandler from '@/plugins/payments/klarna_pay_now/handlers';
import {KlarnaPayNowPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import KlarnaPayNowLoaderInterface from '@/plugins/payments/klarna_pay_now/loader/interface';

class KlarnaPayNowLoader extends PluginLoader implements KlarnaPayNowLoaderInterface {
  public static klarnaPayNowHandler: KlarnaPayNowHandler;

  init(): KlarnaPayNowPayment {
    if (!KlarnaPayNowLoader.klarnaPayNowHandler) {
      KlarnaPayNowLoader.klarnaPayNowHandler = new KlarnaPayNowHandler();
    }
    return KlarnaPayNowLoader.klarnaPayNowHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().klarnaPayNowLoader = new KlarnaPayNowLoader();
