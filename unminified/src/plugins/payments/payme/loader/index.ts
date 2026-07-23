import PayMeHandler from '@/plugins/payments/payme/handlers';
import {PaymePayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import PaymePaymentLoaderInterface from '@/plugins/payments/payme/loader/interface';

class PayMeLoader extends PluginLoader implements PaymePaymentLoaderInterface {
  public static paymeHandler: PayMeHandler;

  init(): PaymePayment {
    if (!PayMeLoader.paymeHandler) {
      PayMeLoader.paymeHandler = new PayMeHandler();
    }
    return PayMeLoader.paymeHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().paymePaymentLoader = new PayMeLoader();
