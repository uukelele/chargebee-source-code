import WechatPayHandler from '@/plugins/payments/wechat_pay/handlers';
import {WechatPayPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import WechatPayLoaderInterface from '@/plugins/payments/wechat_pay/loader/interface';

class WechatPayLoader extends PluginLoader implements WechatPayLoaderInterface {
  public static wechatPayHandler: WechatPayHandler;

  init(): WechatPayPayment {
    if (!WechatPayLoader.wechatPayHandler) {
      WechatPayLoader.wechatPayHandler = new WechatPayHandler();
    }
    return WechatPayLoader.wechatPayHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().wechatPayPaymentLoader = new WechatPayLoader();
