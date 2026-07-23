import BoletoHandler from '@/plugins/payments/boleto/handlers';
import {PaymentMethodType} from '@/internal/payment-intent/types';

export default class stripeBoletoHandler extends BoletoHandler {
  constructor(handler: BoletoHandler, ...args) {
    super(...args);
  }

  initPayment() {
    if (this.getPaymentIntent().reference_id) {
      return Promise.resolve({
        paymentMethodType: PaymentMethodType.BOLETO,
      });
    } else {
      const {
        customer: {firstName, lastName, company, email, phone} = {},
        billingAddress = {},
        taxId = '',
      } = this.paymentInfo;
      return Promise.resolve({
        paymentMethodType: PaymentMethodType.BOLETO,
        paymentMethodDetails: {
          firstName: firstName,
          lastName: lastName,
          companyName: company,
          email: email,
          phone: phone,
          billingAddress: {
            ...billingAddress,
            stateCode: billingAddress.stateCode || billingAddress.state,
          },
          boleto: {
            taxId: taxId,
          },
        },
      });
    }
  }
}
