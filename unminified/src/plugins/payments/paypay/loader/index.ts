import PaypayHandler from '@/plugins/payments/paypay/handlers';
import {PaypayPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import PaypayLoaderInterface from '@/plugins/payments/paypay/loader/interface';

class PaypayLoader extends PluginLoader implements PaypayLoaderInterface {
  public static paypayHandler: PaypayHandler;

  init(): PaypayPayment {
    if (!PaypayLoader.paypayHandler) {
      PaypayLoader.paypayHandler = new PaypayHandler();
    }
    return PaypayLoader.paypayHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().PaypayPaymentLoader = new PaypayLoader();
