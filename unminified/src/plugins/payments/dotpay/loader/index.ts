import DotpayHandler from '@/plugins/payments/dotpay/handlers';
import CbInstanceOptions from '@/interfaces/cb-instance-options';
import {DotpayPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import DotpayLoaderInterface from '@/plugins/payments/dotpay/loader/interface';

class DotpayLoader extends PluginLoader implements DotpayLoaderInterface {
  public static DotpayHandler: DotpayHandler;

  init(): DotpayPayment {
    if (!DotpayLoader.DotpayHandler) {
      const cbOptions: CbInstanceOptions = Chargebee.getInstance().options;
      DotpayLoader.DotpayHandler = new DotpayHandler(cbOptions);
    }
    return DotpayLoader.DotpayHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().dotpayPaymentLoader = new DotpayLoader();
