import NetbankingPaymentHandler from '@/plugins/payments/netbanking_emandates/handlers';
import {NetbankingPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import NetbankingPaymentLoaderInterface from '@/plugins/payments/netbanking_emandates/loader/interface';

class NetbankingPaymentLoader extends PluginLoader implements NetbankingPaymentLoaderInterface {
  public static netbankingPaymentHandler: NetbankingPaymentHandler;

  init(): NetbankingPayment {
    if (!NetbankingPaymentLoader.netbankingPaymentHandler) {
      NetbankingPaymentLoader.netbankingPaymentHandler = new NetbankingPaymentHandler();
    }
    return NetbankingPaymentLoader.netbankingPaymentHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().netbankingPaymentLoader = new NetbankingPaymentLoader();
