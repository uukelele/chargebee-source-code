import GooglePaymentHandler from '@/extensions/payments/google_pay';
import CbInstanceOptions from '@/interfaces/cb-instance-options';
import {GooglePayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import GooglePaymentLoaderInterface from '@/plugins/payments/google_pay/loader/interface';

class GooglePaymentLoader extends PluginLoader implements GooglePaymentLoaderInterface {
  public static googlePaymentHandler: GooglePaymentHandler;

  init(): GooglePayment {
    if (!GooglePaymentLoader.googlePaymentHandler) {
      const cbOptions: CbInstanceOptions = Chargebee.getInstance().options;
      GooglePaymentLoader.googlePaymentHandler = new GooglePaymentHandler(cbOptions);
    }
    return GooglePaymentLoader.googlePaymentHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().googlePaymentLoader = new GooglePaymentLoader();
