import SofortHandler from '@/plugins/payments/sofort/handlers';
import {SofortPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import SofortLoaderInterface from '@/plugins/payments/sofort/loader/interface';

class SofortLoader extends PluginLoader implements SofortLoaderInterface {
  public static sofortHandler: SofortHandler;

  init(): SofortPayment {
    if (!SofortLoader.sofortHandler) {
      SofortLoader.sofortHandler = new SofortHandler();
    }
    return SofortLoader.sofortHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().sofortPaymentLoader = new SofortLoader();
