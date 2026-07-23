import KakaoPayHandler from '@/plugins/payments/kakao_pay/handlers';
import {KakaoPayPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import KakaoPayLoaderInterface from '@/plugins/payments/kakao_pay/loader/interface';

class KakaoPayLoader extends PluginLoader implements KakaoPayLoaderInterface {
  public static kakaoPayHandler: KakaoPayHandler;

  init(): KakaoPayPayment {
    if (!KakaoPayLoader.kakaoPayHandler) {
      KakaoPayLoader.kakaoPayHandler = new KakaoPayHandler();
    }
    return KakaoPayLoader.kakaoPayHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().kakaoPayPaymentLoader = new KakaoPayLoader();
