import GrabPayHandler from '@/plugins/payments/grab_pay/handlers';
import {GrabPayPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import GrabPayLoaderInterface from '@/plugins/payments/grab_pay/loader/interface';

class GrabPayLoader extends PluginLoader implements GrabPayLoaderInterface {
  public static grabPayHandler: GrabPayHandler;

  init(): GrabPayPayment {
    if (!GrabPayLoader.grabPayHandler) {
      GrabPayLoader.grabPayHandler = new GrabPayHandler();
    }
    return GrabPayLoader.grabPayHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().grabPayPaymentLoader = new GrabPayLoader();
