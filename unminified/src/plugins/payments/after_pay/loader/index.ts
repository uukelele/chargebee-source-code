import AfterpayHandler from '@/plugins/payments/after_pay/handlers';
import {AfterpayPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import AfterpayPaymentLoaderInterface from '@/plugins/payments/after_pay/loader/interface';

class AfterpayLoader extends PluginLoader implements AfterpayPaymentLoaderInterface {
  public static afterpayHandler: AfterpayHandler;

  init(): AfterpayPayment {
    if (!AfterpayLoader.afterpayHandler) {
      AfterpayLoader.afterpayHandler = new AfterpayHandler();
    }
    return AfterpayLoader.afterpayHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().afterpayPaymentLoader = new AfterpayLoader();
