import MercadoPagoHandler from '@/plugins/payments/mercado_pago/handlers';
import {MercadoPagoPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import MercadoPagoLoaderInterface from '@/plugins/payments/mercado_pago/loader/interface';

class MercadoPagoLoader extends PluginLoader implements MercadoPagoLoaderInterface {
  public static mercadoPagoHandler: MercadoPagoHandler;

  init(): MercadoPagoPayment {
    if (!MercadoPagoLoader.mercadoPagoHandler) {
      MercadoPagoLoader.mercadoPagoHandler = new MercadoPagoHandler();
    }
    return MercadoPagoLoader.mercadoPagoHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().mercadoPagoPaymentLoader = new MercadoPagoLoader();
