import BizumHandler from '@/plugins/payments/bizum/handlers';
import {BizumPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import BizumPaymentLoaderInterface from '@/plugins/payments/bizum/loader/interface';

class BizumLoader extends PluginLoader implements BizumPaymentLoaderInterface {
  public static bizumHandler: BizumHandler;

  init(): BizumPayment {
    if (!BizumLoader.bizumHandler) {
      BizumLoader.bizumHandler = new BizumHandler();
    }
    return BizumLoader.bizumHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().bizumPaymentLoader = new BizumLoader();
