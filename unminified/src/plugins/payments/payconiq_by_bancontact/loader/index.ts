import PayconiqByBancontactHandler from '@/plugins/payments/payconiq_by_bancontact/handlers';
import {PayconiqByBancontactPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import PayconiqByBancontactLoaderInterface from '@/plugins/payments/payconiq_by_bancontact/loader/interface';

class PayconiqByBancontactLoader extends PluginLoader implements PayconiqByBancontactLoaderInterface {
  public static payconiqByBancontactHandler: PayconiqByBancontactHandler;

  init(): PayconiqByBancontactPayment {
    if (!PayconiqByBancontactLoader.payconiqByBancontactHandler) {
      PayconiqByBancontactLoader.payconiqByBancontactHandler = new PayconiqByBancontactHandler();
    }
    return PayconiqByBancontactLoader.payconiqByBancontactHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().payconiqByBancontactPaymentLoader = new PayconiqByBancontactLoader();
