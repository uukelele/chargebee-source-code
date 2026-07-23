import KbcPaymentButtonHandler from '@/plugins/payments/kbc_payment_button/handlers';
import {KbcPaymentButtonPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import KbcPaymentButtonLoaderInterface from '@/plugins/payments/kbc_payment_button/loader/interface';

class KbcPaymentButtonLoader extends PluginLoader implements KbcPaymentButtonLoaderInterface {
  public static kbcPaymentButtonHandler: KbcPaymentButtonHandler;

  init(): KbcPaymentButtonPayment {
    if (!KbcPaymentButtonLoader.kbcPaymentButtonHandler) {
      KbcPaymentButtonLoader.kbcPaymentButtonHandler = new KbcPaymentButtonHandler();
    }
    return KbcPaymentButtonLoader.kbcPaymentButtonHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().kbcPaymentButtonPaymentLoader = new KbcPaymentButtonLoader();
