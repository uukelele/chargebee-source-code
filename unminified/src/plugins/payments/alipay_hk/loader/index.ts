import AlipayHkHandler from '@/plugins/payments/alipay_hk/handlers';
import {AlipayHkPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import AlipayHkPaymentLoaderInterface from '@/plugins/payments/alipay_hk/loader/interface';

class AlipayHkLoader extends PluginLoader implements AlipayHkPaymentLoaderInterface {
  public static alipayHkHandler: AlipayHkHandler;

  init(): AlipayHkPayment {
    if (!AlipayHkLoader.alipayHkHandler) {
      AlipayHkLoader.alipayHkHandler = new AlipayHkHandler();
    }
    return AlipayHkLoader.alipayHkHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().alipayHkPaymentLoader = new AlipayHkLoader();
