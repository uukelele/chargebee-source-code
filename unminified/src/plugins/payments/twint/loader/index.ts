import TwintHandler from '@/plugins/payments/twint/handlers';
import {TwintPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import TwintLoaderInterface from '@/plugins/payments/twint/loader/interface';

class TwintLoader extends PluginLoader implements TwintLoaderInterface {
  public static twintHandler: TwintHandler;

  init(): TwintPayment {
    if (!TwintLoader.twintHandler) {
      TwintLoader.twintHandler = new TwintHandler();
    }
    return TwintLoader.twintHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().twintPaymentLoader = new TwintLoader();
