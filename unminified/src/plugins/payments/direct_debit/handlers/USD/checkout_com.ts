import AchDirectDebitHandler from '.';
import PlaidHandler from '../../helper/plaid-helper';
import {PaymentOptions} from '@/hosted_fields/common/base-types';
import {PaymentInfo} from '../../types';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {PaymentAttemptStatus} from '@/internal/payment-intent/types';

export default class CheckoutComAchDirectDebitHandler extends AchDirectDebitHandler {
  handlePayment(options: PaymentOptions | any): Promise<any> {
    return this.fetchGWPaymentMethodConfig().then((resp) => {
      const plaidObj = resp.pm_list[0].plaid_config;
      if (typeof plaidObj == 'object' && plaidObj.env) {
        return this.handlePlaidPayment(options, plaidObj);
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
            locale,
            ...plaid,
          },
        };
        return this.initiateAuthorization(plaidPayload, options.callbacks);
      });
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
    }
    return payerInfo;
  }
}
