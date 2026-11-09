import AffirmHandler from '@/plugins/payments/affirm_pay/handlers';
import {AffirmPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import AffirmPaymentLoaderInterface from '@/plugins/payments/affirm_pay/loader/interface';

class AffirmLoader extends PluginLoader implements AffirmPaymentLoaderInterface {
  public static affirmHandler: AffirmHandler;

  init(): AffirmPayment {
    if (!AffirmLoader.affirmHandler) {
      AffirmLoader.affirmHandler = new AffirmHandler();
    }
    return AffirmLoader.affirmHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().affirmPaymentLoader = new AffirmLoader();
