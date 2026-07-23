import ApplepayHandler from '@/plugins/payments/apple_pay/handlers';
import {ApplePayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import ApplepayLoaderInterface from '@/plugins/payments/apple_pay/loader/interface';

class ApplepayLoader extends PluginLoader implements ApplepayLoaderInterface {
  public static applepayHandler: ApplepayHandler;

  init(): ApplePayment {
    if (!ApplepayLoader.applepayHandler) {
      ApplepayLoader.applepayHandler = new ApplepayHandler();
    }
    return ApplepayLoader.applepayHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().applepayPaymentLoader = new ApplepayLoader();
