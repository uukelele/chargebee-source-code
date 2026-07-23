import PromptPayHandler from '@/plugins/payments/promptpay/handlers';
import {PromptPayPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import PromptPayPaymentLoaderInterface from '@/plugins/payments/promptpay/loader/interface';

class PromptPayLoader extends PluginLoader implements PromptPayPaymentLoaderInterface {
  public static promptpayHandler: PromptPayHandler;

  init(): PromptPayPayment {
    if (!PromptPayLoader.promptpayHandler) {
      PromptPayLoader.promptpayHandler = new PromptPayHandler();
    }
    return PromptPayLoader.promptpayHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().promptpayPaymentLoader = new PromptPayLoader();
