import BoletoHandler from '@/plugins/payments/boleto/handlers';
import {BoletoPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import BoletoLoaderInterface from '@/plugins/payments/boleto/loader/interface';

class BoletoLoader extends PluginLoader implements BoletoLoaderInterface {
  public static boletoHandler: BoletoHandler;

  init(): BoletoPayment {
    if (!BoletoLoader.boletoHandler) {
      BoletoLoader.boletoHandler = new BoletoHandler();
    }
    return BoletoLoader.boletoHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().boletoPaymentLoader = new BoletoLoader();
