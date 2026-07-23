import PixHandler from '@/plugins/payments/pix/handlers';
import {PixPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import PixLoaderInterface from '@/plugins/payments/pix/loader/interface';

class PixLoader extends PluginLoader implements PixLoaderInterface {
  public static pixHandler: PixHandler;

  init(): PixPayment {
    if (!PixLoader.pixHandler) {
      PixLoader.pixHandler = new PixHandler();
    }
    return PixLoader.pixHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().pixPaymentLoader = new PixLoader();
