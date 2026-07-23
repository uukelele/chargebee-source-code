import DirectDebitHandler from '@/plugins/payments/direct_debit/handlers';
import {DirectDebitDataManager} from '../../helper/direct-debit-data-manager';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {PaymentAttemptStatus, PaymentAttempt} from '@/internal/payment-intent/types';
import {PaymentOptions} from '@/hosted_fields/common/base-types';
import CbWindowManager from '@/models/cb-window-manager';

export default class MollieDirectDebitHandler extends DirectDebitHandler {
  constructor(handler: DirectDebitHandler, ...args) {
    super(...args);
    if (handler && handler.windowManager) {
      this.windowManager = handler.windowManager;
    } else if (!this.windowManager) {
      this.windowManager = new CbWindowManager();
    }
    this.ddDataManager = DirectDebitDataManager.get(this.getPaymentIntent());
  }

  validate(): Promise<boolean> {
    if (this.ddDataManager.validatePaymentInfo(this.paymentInfo)) {
      return Promise.resolve(true);
    } else {
      return Promise.reject(new CbError(Errors.invalidOrMissingDirectDebitPaymentInfo));
    }
  }

  initPayment() {
    return Promise.resolve(this.ddDataManager.transformPaymentInfo(this.paymentInfo));
  }

  handlePayment(options: PaymentOptions | any): Promise<any> {
    return this.initiateAuthorization(options.paymentInfo, options.callbacks);
  }

  handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_CHALLENGE:
      case PaymentAttemptStatus.REQUIRES_REDIRECTION: {
        return this.redirectToBank(paymentAttempt).then((data) => {
          this.setPaymentIntent(data.payment_intent);
          return this.handlePaymentAttempt(this.getPaymentAttempt());
        });
      }
      default: {
        return Promise.resolve(true);
      }
    }
  }

  private redirectToBank(paymentAttempt: PaymentAttempt): Promise<any> {
    const rawData = paymentAttempt.action_payload;
    const redirectUrl = rawData.redirectUrl || rawData.redirect_url;

    // Check if redirect URL exists
    if (!redirectUrl) {
      const error = new Error(
        'Mollie Direct Debit: Missing redirect URL. ' +
          'Please check backend configuration and ensure Mollie gateway is properly configured for Direct Debit.'
      );
      this.callbackHandler.triggerErrorCallback(error);
      return Promise.reject(error);
    }

    if (this.isRedirectMode && this.getPaymentIntent().success_url) {
      window.location.href = redirectUrl;
      return new Promise(() => {});
    }

    this.windowManager.loadURL(redirectUrl);
    this.windowManager.watchClose(() => this.callbackHandler.triggerCancelCallback());

    return this.pollForAuthCompletion();
  }
}
