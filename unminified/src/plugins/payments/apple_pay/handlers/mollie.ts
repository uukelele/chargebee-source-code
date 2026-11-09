import DirectApplePayHandler from './common';
import type {ApplePaymentEvent} from '@/plugins/payments/apple_pay/types';

/**
 * Mollie direct Apple Pay expects the full Apple Pay payment token (paymentData,
 * paymentMethod, transactionIdentifier) when creating a payment with applePayPaymentToken.
 */
export default class MollieApplePayHandler extends DirectApplePayHandler {
  protected getApplePayToken(event: ApplePaymentEvent): any {
    const token = event.payment.token;
    return {
      transactionIdentifier: token.transactionIdentifier,
      paymentMethod: token.paymentMethod,
      paymentData: token.paymentData,
    };
  }
}
