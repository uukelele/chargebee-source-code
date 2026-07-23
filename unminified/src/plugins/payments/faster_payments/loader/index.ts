import FasterPymtsHandler from '@/plugins/payments/faster_payments/handlers';
import CbInstanceOptions from '@/interfaces/cb-instance-options';
import {FasterPymtsPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import FasterPymtsLoaderInterface from '@/plugins/payments/faster_payments/loader/interface';

class FasterPymtsLoader extends PluginLoader implements FasterPymtsLoaderInterface {
  public static fasterPymtsHandler: FasterPymtsHandler;

  init(): FasterPymtsPayment {
    if (!FasterPymtsLoader.fasterPymtsHandler) {
      const cbOptions: CbInstanceOptions = Chargebee.getInstance().options;
      FasterPymtsLoader.fasterPymtsHandler = new FasterPymtsHandler(cbOptions);
    }
    return FasterPymtsLoader.fasterPymtsHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().fasterPymtsPaymentLoader = new FasterPymtsLoader();
