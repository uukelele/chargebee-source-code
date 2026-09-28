import OvoHandler from '@/plugins/payments/ovo/handlers';
import {OvoPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import OvoLoaderInterface from '@/plugins/payments/ovo/loader/interface';

class OvoLoader extends PluginLoader implements OvoLoaderInterface {
  public static ovoHandler: OvoHandler;

  init(): OvoPayment {
    if (!OvoLoader.ovoHandler) {
      OvoLoader.ovoHandler = new OvoHandler();
    }
    return OvoLoader.ovoHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().ovoPaymentLoader = new OvoLoader();
