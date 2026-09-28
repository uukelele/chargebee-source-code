import MomoHandler from '@/plugins/payments/momo/handlers';
import {MomoPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import MomoPaymentLoaderInterface from '@/plugins/payments/momo/loader/interface';

class MomoLoader extends PluginLoader implements MomoPaymentLoaderInterface {
  public static momoHandler: MomoHandler;

  init(): MomoPayment {
    if (!MomoLoader.momoHandler) {
      MomoLoader.momoHandler = new MomoHandler();
    }
    return MomoLoader.momoHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().momoPaymentLoader = new MomoLoader();
