import {PaymentAttempt, PaymentMethodType} from '@/internal/payment-intent/types';
import ElectronicPaymentStandardHandler from './index';
import {createAdyenInstance, adyenHandlePaymentAttempt} from '@/utils/payments/adyen';

export default class AdyenElectronicPaymentStandardHandler extends ElectronicPaymentStandardHandler {
  private adyenClient: any;

  constructor(handler: ElectronicPaymentStandardHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  async initPayment(): Promise<any> {
    // 1. Create Adyen checkout instance; store for handleAdyenAction
    this.adyenClient = await createAdyenInstance(this.getPaymentIntent(), this);

    // Build and return confirm payload for Electronic Payment Standard
    let payload: any = {
      paymentMethodType: PaymentMethodType.ELECTRONIC_PAYMENT_STANDARD,
    };

    if (this.paymentInfo.customer) {
      payload['paymentMethodDetails'] = {
        firstName: this.paymentInfo.customer.firstName,
        lastName: this.paymentInfo.customer.lastName,
        email: this.paymentInfo.customer.email,
        phone: this.paymentInfo.customer.phone,
      };
      if (this.paymentInfo.customer.billingAddress) {
        payload['paymentMethodDetails']['billingAddress'] = this.paymentInfo.customer.billingAddress;
      }
    }

    return Promise.resolve(payload);
  }

  async handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    // 2. handleAdyenAction (via adyenHandlePaymentAttempt) — mounts 3DS challenge, resolves, confirms
    return adyenHandlePaymentAttempt(paymentAttempt, this, this.adyenClient);
  }
}
