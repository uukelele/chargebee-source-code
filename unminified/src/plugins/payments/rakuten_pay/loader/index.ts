import RakutenPayHandler from '@/plugins/payments/rakuten_pay/handlers';
import {RakutenPayPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import RakutenPayPaymentLoaderInterface from '@/plugins/payments/rakuten_pay/loader/interface';

class RakutenPayLoader extends PluginLoader implements RakutenPayPaymentLoaderInterface {
  public static rakutenPayHandler: RakutenPayHandler;

  init(): RakutenPayPayment {
    if (!RakutenPayLoader.rakutenPayHandler) {
      RakutenPayLoader.rakutenPayHandler = new RakutenPayHandler();
    }
    return RakutenPayLoader.rakutenPayHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().rakutenPayPaymentLoader = new RakutenPayLoader();
