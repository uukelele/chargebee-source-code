import {PaymentMethodType} from '../../../../internal/payment-intent/types';
import PaypayHandler from './index';
import Utils from '@/utils/payments/utils';

export default class StripePaypayHandler extends PaypayHandler {
  constructor(handler: PaypayHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.PAYPAY,
    });
  }
}
