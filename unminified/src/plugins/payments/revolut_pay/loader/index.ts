import RevolutPayHandler from '@/plugins/payments/revolut_pay/handlers';
import {RevolutPayPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import RevolutPayLoaderInterface from '@/plugins/payments/revolut_pay/loader/interface';

class RevolutPayLoader extends PluginLoader implements RevolutPayLoaderInterface {
  public static revolutPayHandler: RevolutPayHandler;

  init(): RevolutPayPayment {
    if (!RevolutPayLoader.revolutPayHandler) {
      RevolutPayLoader.revolutPayHandler = new RevolutPayHandler();
    }
    return RevolutPayLoader.revolutPayHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().revolutPayPaymentLoader = new RevolutPayLoader();
