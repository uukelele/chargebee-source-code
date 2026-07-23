import ElectronicPaymentStandardHandler from '@/plugins/payments/electronic_payment_standard/handlers';
import {ElectronicPaymentStandardPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import ElectronicPaymentStandardLoaderInterface from '@/plugins/payments/electronic_payment_standard/loader/interface';

class ElectronicPaymentStandardLoader extends PluginLoader implements ElectronicPaymentStandardLoaderInterface {
  public static electronicPaymentStandardHandler: ElectronicPaymentStandardHandler;

  init(): ElectronicPaymentStandardPayment {
    if (!ElectronicPaymentStandardLoader.electronicPaymentStandardHandler) {
      ElectronicPaymentStandardLoader.electronicPaymentStandardHandler = new ElectronicPaymentStandardHandler();
    }
    return ElectronicPaymentStandardLoader.electronicPaymentStandardHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().electronicPaymentStandardPaymentLoader = new ElectronicPaymentStandardLoader();
