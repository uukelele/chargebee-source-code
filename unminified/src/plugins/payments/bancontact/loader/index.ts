import BancontactHandler from '@/plugins/payments/bancontact/handlers';
import {BancontactPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import BancontactLoaderInterface from '@/plugins/payments/bancontact/loader/interface';

class BancontactLoader extends PluginLoader implements BancontactLoaderInterface {
  public static bancontactHandler: BancontactHandler;

  init(): BancontactPayment {
    if (!BancontactLoader.bancontactHandler) {
      BancontactLoader.bancontactHandler = new BancontactHandler();
    }
    return BancontactLoader.bancontactHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().bancontactPaymentLoader = new BancontactLoader();
