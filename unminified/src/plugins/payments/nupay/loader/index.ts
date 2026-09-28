import NupayHandler from '@/plugins/payments/nupay/handlers';
import {NupayPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import NupayLoaderInterface from '@/plugins/payments/nupay/loader/interface';

class NupayLoader extends PluginLoader implements NupayLoaderInterface {
  public static nupayHandler: NupayHandler;

  init(): NupayPayment {
    if (!NupayLoader.nupayHandler) {
      NupayLoader.nupayHandler = new NupayHandler();
    }
    return NupayLoader.nupayHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().nupayPaymentLoader = new NupayLoader();
