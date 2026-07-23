import TrustlyHandler from '@/plugins/payments/trustly/handlers';
import {TrustlyPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import TrustlyLoaderInterface from '@/plugins/payments/trustly/loader/interface';

class TrustlyLoader extends PluginLoader implements TrustlyLoaderInterface {
  public static trustlyHandler: TrustlyHandler;

  init(): TrustlyPayment {
    if (!TrustlyLoader.trustlyHandler) {
      TrustlyLoader.trustlyHandler = new TrustlyHandler();
    }
    return TrustlyLoader.trustlyHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().trustlyPaymentLoader = new TrustlyLoader();
