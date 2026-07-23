import GoPayHandler from '@/plugins/payments/go_pay/handlers';
import {GoPayPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import GoPayLoaderInterface from '@/plugins/payments/go_pay/loader/interface';

class GoPayLoader extends PluginLoader implements GoPayLoaderInterface {
  public static goPayHandler: GoPayHandler;

  init(): GoPayPayment {
    if (!GoPayLoader.goPayHandler) {
      GoPayLoader.goPayHandler = new GoPayHandler();
    }
    return GoPayLoader.goPayHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().goPayPaymentLoader = new GoPayLoader();
