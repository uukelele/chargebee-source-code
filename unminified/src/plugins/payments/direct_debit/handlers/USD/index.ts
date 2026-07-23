import DirectDebitHandler from '@/plugins/payments/direct_debit/handlers';
import {DirectDebitDataHelper} from '../../helper/direct-debit-data-helper';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {PaymentAttemptStatus, PaymentAttempt} from '@/internal/payment-intent/types';
import {PaymentOptions} from '@/hosted_fields/common/base-types';

export default class AchDirectDebitHandler extends DirectDebitHandler {
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
