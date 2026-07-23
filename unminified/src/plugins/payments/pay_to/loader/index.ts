import PayToHandler from '@/plugins/payments/pay_to/handlers';
import CbInstanceOptions from '@/interfaces/cb-instance-options';
import {PayToPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import PayToLoaderInterface from '@/plugins/payments/pay_to/loader/interface';

class PayToLoader extends PluginLoader implements PayToLoaderInterface {
  public static payToHandler: PayToHandler;

  init(): PayToPayment {
    if (!PayToLoader.payToHandler) {
      const cbOptions: CbInstanceOptions = Chargebee.getInstance().options;
      PayToLoader.payToHandler = new PayToHandler(cbOptions);
    }
    return PayToLoader.payToHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().payToPaymentLoader = new PayToLoader();
