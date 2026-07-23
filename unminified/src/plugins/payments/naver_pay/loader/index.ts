import NaverPayHandler from '@/plugins/payments/naver_pay/handlers';
import {NaverPayPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import NaverPayLoaderInterface from '@/plugins/payments/naver_pay/loader/interface';

class NaverPayLoader extends PluginLoader implements NaverPayLoaderInterface {
  public static naverPayHandler: NaverPayHandler;

  init(): NaverPayPayment {
    if (!NaverPayLoader.naverPayHandler) {
      NaverPayLoader.naverPayHandler = new NaverPayHandler();
    }
    return NaverPayLoader.naverPayHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().naverPayPaymentLoader = new NaverPayLoader();
