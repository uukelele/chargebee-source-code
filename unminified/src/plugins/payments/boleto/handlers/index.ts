import {PaymentRedirectTimeouts} from '@/constants/enums';
import {BoletoPayment, PaymentOptions} from '@/hosted_fields/common/base-types';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {PaymentAttemptStatus, PaymentAttempt} from '@/internal/payment-intent/types';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {Callbacks, Gateway} from '@/extensions/three_domain_secure/common/types';
import {PaymentInfo} from '../types';

export default class BoletoHandler extends PaymentIntentHandler implements BoletoPayment {
  protected declare paymentInfo: PaymentInfo;
  redirectTimeout: number = PaymentRedirectTimeouts.BOLETO;

  constructor(...args) {
    super(...args);
  }

  validate(): Promise<boolean> {
    const intent = this.getPaymentIntent();
    const paymentInfo = this.paymentInfo;
    let isValid = false;
    if (!!intent.reference_id && (!paymentInfo || !paymentInfo.customer)) {
      return Promise.reject(new CbError(Errors.missingBoletoPaymentInfo));
    }
    switch (intent.gateway) {
      case Gateway.STRIPE:
        isValid =
          !!intent.reference_id ||
          !!(
            paymentInfo.customer &&
            paymentInfo.customer.firstName &&
            paymentInfo.customer.lastName &&
            paymentInfo.customer.email &&
            paymentInfo.billingAddress &&
            paymentInfo.taxId
          );
    }
    if (isValid) {
      return Promise.resolve(true);
    } else {
      return Promise.reject(new CbError(Errors.invalidOrMissingBoletoPaymentInfo));
    }
  }

  handleBoletoPayment(paymentInfo: PaymentInfo, callbacks?: Callbacks): Promise<any> {
    return this.getGatewayHandler(this.getPaymentIntent()).then((handler) =>
      handler.initiateAuthorization(paymentInfo, callbacks)
    );
  }

  handlePayment(input: PaymentInfo | PaymentOptions, callbacks?: Callbacks): Promise<any> {
    let paymentInfo: PaymentInfo = input as PaymentInfo;
    return Promise.resolve(true)
      .then(() => {
        if (input == null || !((input as PaymentOptions).paymentIntent instanceof Function)) {
          return;
        }
        paymentInfo = (input as PaymentOptions).paymentInfo as PaymentInfo;
        callbacks = (input as PaymentOptions).callbacks;
        return (input as PaymentOptions)
          .paymentIntent()
          .then((paymentIntent) => this.setPaymentIntent(this.validatePaymentIntent(paymentIntent)));
      })
      .then(() => {
        return this.handleBoletoPayment(paymentInfo, callbacks);
      });
  }
}
