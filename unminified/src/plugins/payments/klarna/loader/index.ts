import KlarnaHandler from '@/plugins/payments/klarna/handlers';
import {KlarnaPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import KlarnaPaymentLoaderInterface from '@/plugins/payments/klarna/loader/interface';

class KlarnaLoader extends PluginLoader implements KlarnaPaymentLoaderInterface {
  public static klarnaHandler: KlarnaHandler;

  init(): KlarnaPayment {
    if (!KlarnaLoader.klarnaHandler) {
      KlarnaLoader.klarnaHandler = new KlarnaHandler();
    }
    return KlarnaLoader.klarnaHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().klarnaPaymentLoader = new KlarnaLoader();
