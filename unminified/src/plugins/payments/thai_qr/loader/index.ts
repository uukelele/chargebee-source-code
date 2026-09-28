import ThaiQrHandler from '@/plugins/payments/thai_qr/handlers';
import {ThaiQrPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import ThaiQrLoaderInterface from '@/plugins/payments/thai_qr/loader/interface';

class ThaiQrLoader extends PluginLoader implements ThaiQrLoaderInterface {
  public static thaiQrHandler: ThaiQrHandler;

  init(): ThaiQrPayment {
    if (!ThaiQrLoader.thaiQrHandler) {
      ThaiQrLoader.thaiQrHandler = new ThaiQrHandler();
    }
    return ThaiQrLoader.thaiQrHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().thaiQrPaymentLoader = new ThaiQrLoader();
