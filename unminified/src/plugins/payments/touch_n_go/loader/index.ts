import TouchNGoHandler from '@/plugins/payments/touch_n_go/handlers';
import {TouchNGoPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import TouchNGoPaymentLoaderInterface from '@/plugins/payments/touch_n_go/loader/interface';

class TouchNGoLoader extends PluginLoader implements TouchNGoPaymentLoaderInterface {
  public static touchngoHandler: TouchNGoHandler;

  init(): TouchNGoPayment {
    if (!TouchNGoLoader.touchngoHandler) {
      TouchNGoLoader.touchngoHandler = new TouchNGoHandler();
    }
    return TouchNGoLoader.touchngoHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().touchNGoPaymentLoader = new TouchNGoLoader();
