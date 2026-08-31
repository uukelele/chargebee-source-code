import QpayHandler from '@/plugins/payments/qpay/handlers';
import {QpayPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import QpayPaymentLoaderInterface from '@/plugins/payments/qpay/loader/interface';

class QpayLoader extends PluginLoader implements QpayPaymentLoaderInterface {
  public static qpayHandler: QpayHandler;

  init(): QpayPayment {
    if (!QpayLoader.qpayHandler) {
      QpayLoader.qpayHandler = new QpayHandler();
    }
    return QpayLoader.qpayHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().qpayPaymentLoader = new QpayLoader();
