import PluginLoader from '@/plugins/core/loader';
import {VenmoPayment} from '@/hosted_fields/common/base-types';
import VenmoHandler from '@/plugins/payments/venmo/handlers';
import VenmoPaymentLoaderInterface from '@/plugins/payments/venmo/loader/interface';

class VenmoLoader extends PluginLoader implements VenmoPaymentLoaderInterface {
  public static venmoHandler: VenmoHandler;

  init(): VenmoPayment {
    if (!VenmoLoader.venmoHandler) {
      VenmoLoader.venmoHandler = new VenmoHandler();
    }
    return VenmoLoader.venmoHandler;
  }
}

declare let Chargebee;
Chargebee.getInstance().venmoPaymentLoader = new VenmoLoader();
