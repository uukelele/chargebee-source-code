import UpiHandler from '@/plugins/payments/upi/handlers';
import {UpiPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import UpiLoaderInterface from '@/plugins/payments/upi/loader/interface';

class UpiLoader extends PluginLoader implements UpiLoaderInterface {
  public static upiHandler: UpiHandler;

  init(): UpiPayment {
    if (!UpiLoader.upiHandler) {
      UpiLoader.upiHandler = new UpiHandler();
    }
    return UpiLoader.upiHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().upiPaymentLoader = new UpiLoader();
