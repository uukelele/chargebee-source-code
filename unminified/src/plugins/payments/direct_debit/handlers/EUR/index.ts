import DirectDebitHandler from '@/plugins/payments/direct_debit/handlers';
import {DirectDebitDataHelper} from '../../helper/direct-debit-data-helper';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {PaymentAttemptStatus, PaymentAttempt} from '@/internal/payment-intent/types';
import {PaymentOptions} from '@/hosted_fields/common/base-types';

/**
 * Handler for SEPA direct debit gateways that use direct API flow (no redirection).
 * Used by: Stripe, Adyen, Mollie, etc.
 *
 * For redirect-based gateways like Twikey, the CommonDirectDebitHandler is used instead.
 */
export default class SepaDirectDebitHandler extends DirectDebitHandler {
  constructor(handler: DirectDebitHandler, ...args) {
    super(...args);
    this.ddDataHelper = new DirectDebitDataHelper(this.getPaymentIntent());
  }

  validate(): Promise<boolean> {
    if (this.ddDataHelper.validatePaymentInfo(this.paymentInfo)) {
      return Promise.resolve(true);
    } else {
      return Promise.reject(new CbError(Errors.missingDirectDebitPaymentInfo));
    }
  }

  initPayment() {
    return Promise.resolve(this.ddDataHelper.transformPaymentInfo(this.paymentInfo));
  }

  handlePayment(options: PaymentOptions | any): Promise<any> {
    return this.initiateAuthorization(options.paymentInfo, options.callbacks);
  }

  handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_CHALLENGE:
      case PaymentAttemptStatus.REQUIRES_REDIRECTION: {
        throw new CbError(Errors.unknownPaymentAttemptStatus);
      }
      default: {
        return Promise.resolve(true);
      }
    }
  }
}
