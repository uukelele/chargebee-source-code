import {PaymentAttempt, PaymentMethodType} from '@/internal/payment-intent/types';
import PaypayHandler from './index';
import {createAdyenInstance, adyenHandlePaymentAttempt} from '@/utils/payments/adyen';

export default class AdyenPaypayHandler extends PaypayHandler {
  private adyenClient: any;

  constructor(handler: PaypayHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  async initPayment(): Promise<any> {
    this.adyenClient = await createAdyenInstance(this.getPaymentIntent(), this);

    let payload: any = {
      paymentMethodType: PaymentMethodType.PAYPAY,
    };

    if (this.paymentInfo && this.paymentInfo.customer) {
      payload['paymentMethodDetails'] = {
        firstName: this.paymentInfo.customer.firstName,
        lastName: this.paymentInfo.customer.lastName,
        email: this.paymentInfo.customer.email,
        phone: this.paymentInfo.customer.phone,
      };
      if ((this.paymentInfo.customer as any).billingAddress) {
        payload['paymentMethodDetails']['billingAddress'] = (this.paymentInfo.customer as any).billingAddress;
      }
    }

    return Promise.resolve(payload);
  }

  async handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    return adyenHandlePaymentAttempt(paymentAttempt, this, this.adyenClient).then((data) => {
      const {payment_intent: paymentIntent} = data || {};
      if (paymentIntent) {
        this.setPaymentIntent(data.payment_intent);
      }
      return data;
    });  }
}
