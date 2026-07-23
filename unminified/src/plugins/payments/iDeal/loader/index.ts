import IDealHandler from '@/extensions/payments/iDeal';
import CbInstanceOptions from '@/interfaces/cb-instance-options';
import {IDealPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import IDealLoaderInterface from '@/plugins/payments/iDeal/loader/interface';

class IDealLoader extends PluginLoader implements IDealLoaderInterface {
  public static iDealHandler: IDealHandler;

  init(): IDealPayment {
    if (!IDealLoader.iDealHandler) {
      const cbOptions: CbInstanceOptions = Chargebee.getInstance().options;
      IDealLoader.iDealHandler = new IDealHandler(cbOptions);
    }
    return IDealLoader.iDealHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().iDealPaymentLoader = new IDealLoader();
