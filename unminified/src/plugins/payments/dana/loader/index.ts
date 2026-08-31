import DanaHandler from '@/plugins/payments/dana/handlers';
import {DanaPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import DanaPaymentLoaderInterface from '@/plugins/payments/dana/loader/interface';

class DanaLoader extends PluginLoader implements DanaPaymentLoaderInterface {
  public static danaHandler: DanaHandler;

  init(): DanaPayment {
    if (!DanaLoader.danaHandler) {
      DanaLoader.danaHandler = new DanaHandler();
    }
    return DanaLoader.danaHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().danaPaymentLoader = new DanaLoader();
