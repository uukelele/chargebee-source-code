import GcashHandler from '@/plugins/payments/gcash/handlers';
import {GcashPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import GcashPaymentLoaderInterface from '@/plugins/payments/gcash/loader/interface';

class GcashLoader extends PluginLoader implements GcashPaymentLoaderInterface {
  public static gcashHandler: GcashHandler;

  init(): GcashPayment {
    if (!GcashLoader.gcashHandler) {
      GcashLoader.gcashHandler = new GcashHandler();
    }
    return GcashLoader.gcashHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().gcashPaymentLoader = new GcashLoader();
