import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {VenmoPayment} from '@/hosted_fields/common/base-types';
import {Callbacks, PaymentIntent, PaymentMethodType} from '@/internal/payment-intent/types';
import {ButtonStyle, Options} from '@/plugins/payments/venmo/types';

export default class VenmoHandler extends PaymentIntentHandler implements VenmoPayment {
  private static gatewayHandlerCache: Record<string, any> = {};
  private handler: PaymentIntentHandler;

  constructor(...args) {
    super(...args);
  }
  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.VENMO,
    });
  }

  async mountPaymentButton(id: string, options: Options = {}): Promise<any> {
    options.style = Object.assign(this.getVenmoStyles(), options.style);
    const gatewayHandlerKey =
      this.getPaymentIntent().id + this.getPaymentIntent().gateway_account_id + this.getPaymentIntent().currency_code;
    if (VenmoHandler.gatewayHandlerCache[gatewayHandlerKey]) {
      this.handler = VenmoHandler.gatewayHandlerCache[gatewayHandlerKey];
      this.handler.setPaymentIntent(this.getPaymentIntent());
    } else {
      this.handler = await this.getGatewayHandler(this.getPaymentIntent());
      VenmoHandler.gatewayHandlerCache[gatewayHandlerKey] = this.handler;
    }
    return this.handler.mountPaymentButton(id, options);
  }

  handlePayment(callbacks: Callbacks): Promise<PaymentIntent> {
    return this.handler.handlePayment(callbacks);
  }

  /* venmo(){
        return window['venmo'];
    }*/
  getVenmoStyles(): ButtonStyle {
    return {
      size: 'medium',
      color: 'blue',
      shape: 'pill',
      tagline: false,
    };
  }
}
