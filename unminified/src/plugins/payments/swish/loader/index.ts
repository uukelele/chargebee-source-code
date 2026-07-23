import SwishHandler from '@/plugins/payments/swish/handlers';
import {SwishPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import SwishPaymentLoaderInterface from '@/plugins/payments/swish/loader/interface';

class SwishLoader extends PluginLoader implements SwishPaymentLoaderInterface {
  public static swishHandler: SwishHandler;

  init(): SwishPayment {
    if (!SwishLoader.swishHandler) {
      SwishLoader.swishHandler = new SwishHandler();
    }
    return SwishLoader.swishHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().swishPaymentLoader = new SwishLoader();
