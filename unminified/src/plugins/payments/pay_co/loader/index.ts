import PayCoHandler from '@/plugins/payments/pay_co/handlers';
import {PayCoPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import PayCoLoaderInterface from '@/plugins/payments/pay_co/loader/interface';

class PayCoLoader extends PluginLoader implements PayCoLoaderInterface {
  public static payCoHandler: PayCoHandler;

  init(): PayCoPayment {
    if (!PayCoLoader.payCoHandler) {
      PayCoLoader.payCoHandler = new PayCoHandler();
    }
    return PayCoLoader.payCoHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().payCoPaymentLoader = new PayCoLoader();
