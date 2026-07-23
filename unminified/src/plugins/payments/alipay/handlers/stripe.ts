import {PaymentMethodType} from '@/internal/payment-intent/types';
import AlipayHandler from './index';
import type {PaymentInfo as AlipayPaymentInfo} from '../types';

type RuntimeAlipayPaymentInfo = AlipayPaymentInfo & {
  retainPaymentMethod?: boolean;
};

export default class StripeAlipayHandler extends AlipayHandler {
  constructor(handler: AlipayHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment() {
    const paymentInfo = this.paymentInfo as RuntimeAlipayPaymentInfo | undefined;
    const result: any = {
      paymentMethodType: PaymentMethodType.ALIPAY,
    };

    if (paymentInfo && paymentInfo.retainPaymentMethod === false) {
      result.retainPaymentMethod = false;
    }

    return Promise.resolve(result);
  }
}
