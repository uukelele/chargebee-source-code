import GiropayHandler from '@/plugins/payments/giropay/handlers';
import CbInstanceOptions from '@/interfaces/cb-instance-options';
import {GiropayPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import GiropayLoaderInterface from '@/plugins/payments/giropay/loader/interface';

class GiropayLoader extends PluginLoader implements GiropayLoaderInterface {
  public static GiropayHandler: GiropayHandler;

  init(): GiropayPayment {
    if (!GiropayLoader.GiropayHandler) {
      const cbOptions: CbInstanceOptions = Chargebee.getInstance().options;
      GiropayLoader.GiropayHandler = new GiropayHandler(cbOptions);
    }
    return GiropayLoader.GiropayHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().giropayPaymentLoader = new GiropayLoader();
