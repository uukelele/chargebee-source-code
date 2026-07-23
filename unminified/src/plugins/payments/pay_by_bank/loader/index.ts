import PayByBankHandler from '@/plugins/payments/pay_by_bank/handlers';
import {PayByBankPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import PayByBankLoaderInterface from '@/plugins/payments/pay_by_bank/loader/interface';

class PayByBankLoader extends PluginLoader implements PayByBankLoaderInterface {
  public static payByBankHandler: PayByBankHandler;

  init(): PayByBankPayment {
    if (!PayByBankLoader.payByBankHandler) {
      PayByBankLoader.payByBankHandler = new PayByBankHandler();
    }
    return PayByBankLoader.payByBankHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().payByBankPaymentLoader = new PayByBankLoader();
