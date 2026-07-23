import {PaymentAttempt} from '@/internal/payment-intent/types';
import PaymentMethodHandler from './index';
import {PaymentInfo} from '../types';
import {createAdyenInstance, adyenHandlePaymentAttempt} from '@/utils/payments/adyen';
import {PaymentMethodType} from '@/internal/payment-intent/types';

export default class AdyenHandler extends PaymentMethodHandler {
  private adyenClient: any;

  constructor(handler: PaymentMethodHandler, ...args) {
    super(...args);
  }

  async initPayment(paymentInfo?: PaymentInfo): Promise<any> {
    // 1. Create Adyen checkout instance; store for handleAdyenAction
    this.adyenClient = await createAdyenInstance(this.getPaymentIntent(), this);
    // Build and return confirm payload for Swish payment method
    return {
      paymentMethodType: PaymentMethodType.SWISH,
    };
  }

  async handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    // 2. handleAdyenAction (via adyenHandlePaymentAttempt) — mounts 3DS challenge, resolves, confirms
    return adyenHandlePaymentAttempt(paymentAttempt, this, this.adyenClient);
  }
}
