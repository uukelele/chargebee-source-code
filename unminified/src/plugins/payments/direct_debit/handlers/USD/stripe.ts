import AchDirectDebitHandler from '.';
import PlaidHandler from '@/plugins/payments/direct_debit/helper/plaid-helper';
import FCHandler from '@/plugins/payments/direct_debit/helper/financial-connections';
import {PaymentOptions} from '@/hosted_fields/common/base-types';
import {PaymentInfo} from '../../types';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {PaymentAttemptStatus, PaymentMethodType} from '@/internal/payment-intent/types';

const SUPPORTED_VERIFICATION = {
  PLAID: 'plaid',
  FINANCIAL_CONNECTIONS: 'FINANCIAL_CONNECTIONS',
};
export default class StripeAchDirectDebitHandler extends AchDirectDebitHandler {
  verificationFlow = null;
  fCHandler = null;

  handlePayment(options: PaymentOptions | any): Promise<any> {
    return this.fetchGWPaymentMethodConfig().then((resp) => {
      const plaidObj = resp.pm_list[0].plaid_config;
      const fCObj = resp.pm_list[0].financial_connections_config;
      if (typeof plaidObj == 'object' && plaidObj.env) {
        this.verificationFlow = SUPPORTED_VERIFICATION.PLAID;
        return this.handlePlaidPayment(options, plaidObj);
      } else if (typeof fCObj == 'object' && fCObj.type == SUPPORTED_VERIFICATION.FINANCIAL_CONNECTIONS) {
        this.verificationFlow = SUPPORTED_VERIFICATION.FINANCIAL_CONNECTIONS;
        return this.handleFCPayment(options);
      } else {
        throw new CbError(Errors.plaidNotsupported);
      }
    });
  }

  handlePlaidPayment(options: PaymentOptions | any, plaidObj): Promise<any> {
    const paymentInfo: PaymentInfo = options.paymentInfo;
    const plaidHandler = new PlaidHandler();
    const userId = (paymentInfo && paymentInfo.plaid && paymentInfo.plaid.userId) || '';
    const locale = (paymentInfo && paymentInfo.plaid && paymentInfo.plaid.locale) || 'en-US';
    return plaidHandler
      .setupPlaid(
        {
          userId,
          locale,
          env: plaidObj.env,
        },
        this.getPaymentIntent()
      )
      .then((plaid: object) => {
        const plaidPayload = {
          payload: {
            plaid: true,
            locale,
            ...plaid,
          },
          ...options.paymentInfo,
        };
        return this.initiateAuthorization(plaidPayload, options.callbacks);
      });
  }

  handleFCPayment(options: PaymentOptions | any): Promise<any> {
    const paymentInfo: PaymentInfo = options.paymentInfo;
    this.fCHandler = new FCHandler(paymentInfo);
    return this.fCHandler.setupFinancialConnections(this.getPaymentIntent()).then(() => {
      return this.initiateAuthorization(paymentInfo, options.callbacks);
    });
  }

  collectBankAccountForFC(paymentAttemptStatus) {
    if (this.fCHandler) {
      return this.fCHandler.collectBankAccountForSetup(this.getPaymentAttempt().action_payload).then(() => {
        return this.confirmPayment({
          paymentMethodType: PaymentMethodType.DIRECT_DEBIT,
        });
      });
    } else {
      return super.handlePaymentAttemptStatus(paymentAttemptStatus);
    }
  }

  handlePaymentAttemptStatus(paymentAttemptStatus: PaymentAttemptStatus): Promise<any> {
    switch (paymentAttemptStatus) {
      case PaymentAttemptStatus.AUTHORIZED:
        this.setPaymentIntent({
          ...this.getPaymentIntent(),
          payer_info: {...this.getPayerInfo()},
        });
        this.callbackHandler.triggerSuccessCallback();
        return Promise.resolve(this.getPaymentIntent());
      case PaymentAttemptStatus.REQUIRES_REDIRECTION:
        return this.collectBankAccountForFC(paymentAttemptStatus);
      default:
        return super.handlePaymentAttemptStatus(paymentAttemptStatus);
    }
  }

  getPayerInfo(): any {
    let payerInfo: any = {};
    const payload = this.getPaymentAttempt().action_payload;
    if (payload) {
      payerInfo.bank = {
        bank_name: payload.bank_name,
        last4: payload.last4,
      };
      payerInfo.gateway = {
        stripe_token: payload.stripeToken,
      };
    }
    return payerInfo;
  }
}
