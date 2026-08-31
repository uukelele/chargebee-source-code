import TamaraHandler from '@/plugins/payments/tamara/handlers';
import {TamaraPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import TamaraPaymentLoaderInterface from '@/plugins/payments/tamara/loader/interface';

class TamaraLoader extends PluginLoader implements TamaraPaymentLoaderInterface {
  public static tamaraHandler: TamaraHandler;

  init(): TamaraPayment {
    if (!TamaraLoader.tamaraHandler) {
      TamaraLoader.tamaraHandler = new TamaraHandler();
    }
    return TamaraLoader.tamaraHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().tamaraPaymentLoader = new TamaraLoader();
