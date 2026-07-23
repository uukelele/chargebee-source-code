import AlipayHandler from '@/plugins/payments/alipay/handlers';
import {AlipayPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import AlipayLoaderInterface from '@/plugins/payments/alipay/loader/interface';

class AlipayLoader extends PluginLoader implements AlipayLoaderInterface {
  public static alipayHandler: AlipayHandler;

  init(): AlipayPayment {
    if (!AlipayLoader.alipayHandler) {
      AlipayLoader.alipayHandler = new AlipayHandler();
    }
    return AlipayLoader.alipayHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().alipayPaymentLoader = new AlipayLoader();
