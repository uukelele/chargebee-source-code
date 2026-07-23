import StablecoinHandler from '@/plugins/payments/stablecoin/handlers';
import {StablecoinPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import StablecoinLoaderInterface from '@/plugins/payments/stablecoin/loader/interface';

class StablecoinLoader extends PluginLoader implements StablecoinLoaderInterface {
  public static stablecoinHandler: StablecoinHandler;

  init(): StablecoinPayment {
    if (!StablecoinLoader.stablecoinHandler) {
      StablecoinLoader.stablecoinHandler = new StablecoinHandler();
    }
    return StablecoinLoader.stablecoinHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().stablecoinPaymentLoader = new StablecoinLoader();
