import AmazonPayHandler from '@/plugins/payments/amazon_payments/handlers';
import {AmazonPayPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import AmazonPayLoaderInterface from '@/plugins/payments/amazon_payments/loader/interface';

class AmazonPayLoader extends PluginLoader implements AmazonPayLoaderInterface {
  public static amazonPayHandler: AmazonPayHandler;

  init(): AmazonPayPayment {
    if (!AmazonPayLoader.amazonPayHandler) {
      AmazonPayLoader.amazonPayHandler = new AmazonPayHandler();
    }
    return AmazonPayLoader.amazonPayHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().amazonpayPaymentLoader = new AmazonPayLoader();
