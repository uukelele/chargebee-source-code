import CashAppPayHandler from '@/plugins/payments/cash_app_pay/handlers';
import {CashAppPayPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import CashAppPayLoaderInterface from '@/plugins/payments/cash_app_pay/loader/interface';

class CashAppPayLoader extends PluginLoader implements CashAppPayLoaderInterface {
  public static cashAppPayHandler: CashAppPayHandler;

  init(): CashAppPayPayment {
    if (!CashAppPayLoader.cashAppPayHandler) {
      CashAppPayLoader.cashAppPayHandler = new CashAppPayHandler();
    }
    return CashAppPayLoader.cashAppPayHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().cashAppPayPaymentLoader = new CashAppPayLoader();
