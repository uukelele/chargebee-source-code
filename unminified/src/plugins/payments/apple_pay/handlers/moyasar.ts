import DirectApplePayHandler from './common';
import type {ApplePaymentEvent} from '@/plugins/payments/apple_pay/types';

export default class MoyasarApplePayHandler extends DirectApplePayHandler {
  protected getSupportedNetworks(): string[] {
    return ['mada', 'visa', 'masterCard', 'amex', 'unionpay'];
  }

  protected getMerchantCapabilities(): string[] {
    return ['supports3DS', 'supportsDebit', 'supportsCredit'];
  }

  protected getApplePaySessionVersion(): number {
    return 5;
  }

  protected getApplePayToken(event: ApplePaymentEvent): any {
    return event.payment.token;
  }
}
