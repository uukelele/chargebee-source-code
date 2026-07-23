import SepaInstantTransferHandler from '@/plugins/payments/sepa_instant_transfer/handlers';
import CbInstanceOptions from '@/interfaces/cb-instance-options';
import {SepaInstantTransferPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import SepaInstantTransferLoaderInterface from '@/plugins/payments/sepa_instant_transfer/loader/interface';

class SepaInstantTransferLoader extends PluginLoader implements SepaInstantTransferLoaderInterface {
  public static sepaInstantTransferHandler: SepaInstantTransferHandler;

  init(): SepaInstantTransferPayment {
    if (!SepaInstantTransferLoader.sepaInstantTransferHandler) {
      const cbOptions: CbInstanceOptions = Chargebee.getInstance().options;
      SepaInstantTransferLoader.sepaInstantTransferHandler = new SepaInstantTransferHandler(cbOptions);
    }
    return SepaInstantTransferLoader.sepaInstantTransferHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().sepaInstantTransferPaymentLoader = new SepaInstantTransferLoader();
