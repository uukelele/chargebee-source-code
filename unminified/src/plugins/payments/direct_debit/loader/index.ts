import DirectDebitHandler from '@/plugins/payments/direct_debit/handlers';
import {DirectDebitPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import DirectDebitLoaderInterface from '@/plugins/payments/direct_debit/loader/interface';

class DirectDebitLoader extends PluginLoader implements DirectDebitLoaderInterface {
  public static directDebitHandler: DirectDebitHandler;

  init(): DirectDebitPayment {
    if (!DirectDebitLoader.directDebitHandler) {
      DirectDebitLoader.directDebitHandler = new DirectDebitHandler();
    }
    return DirectDebitLoader.directDebitHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().directDebitPaymentLoader = new DirectDebitLoader();
