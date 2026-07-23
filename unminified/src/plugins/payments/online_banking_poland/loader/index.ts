import OnlineBankingPolandPaymentHandler from '@/plugins/payments/online_banking_poland/handlers';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import OnlineBankingPolandPaymentLoaderInterface from '@/plugins/payments/online_banking_poland/loader/interface';
import {OnlineBankingPolandPayment} from '@/hosted_fields/common/base-types';

class OnlineBankingPolandPaymentLoader extends PluginLoader implements OnlineBankingPolandPaymentLoaderInterface {
  public static onlineBankingPolandPaymentHandler: OnlineBankingPolandPaymentHandler;

  init(): OnlineBankingPolandPayment {
    if (!OnlineBankingPolandPaymentLoader.onlineBankingPolandPaymentHandler) {
      OnlineBankingPolandPaymentLoader.onlineBankingPolandPaymentHandler = new OnlineBankingPolandPaymentHandler();
    }
    return OnlineBankingPolandPaymentLoader.onlineBankingPolandPaymentHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().onlineBankingPolandPaymentLoader = new OnlineBankingPolandPaymentLoader();
