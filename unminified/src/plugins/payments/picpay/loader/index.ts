import PicpayHandler from '@/plugins/payments/picpay/handlers';
import {PicpayPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import PicpayLoaderInterface from '@/plugins/payments/picpay/loader/interface';

class PicpayLoader extends PluginLoader implements PicpayLoaderInterface {
  public static picpayHandler: PicpayHandler;

  init(): PicpayPayment {
    if (!PicpayLoader.picpayHandler) {
      PicpayLoader.picpayHandler = new PicpayHandler();
    }
    return PicpayLoader.picpayHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().picpayPaymentLoader = new PicpayLoader();
