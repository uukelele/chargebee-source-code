import NequiHandler from '@/plugins/payments/nequi/handlers';
import {NequiPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import NequiLoaderInterface from '@/plugins/payments/nequi/loader/interface';

class NequiLoader extends PluginLoader implements NequiLoaderInterface {
  public static nequiHandler: NequiHandler;

  init(): NequiPayment {
    if (!NequiLoader.nequiHandler) {
      NequiLoader.nequiHandler = new NequiHandler();
    }
    return NequiLoader.nequiHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().nequiPaymentLoader = new NequiLoader();
