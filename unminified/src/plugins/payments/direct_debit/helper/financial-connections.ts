import {PaymentInfo} from '../types';
import {CbError, ErrorType} from '@/hosted_fields/common/errors';
import {getStripeV3} from '@/utils/payments/stripe';

const FCRequirePaymentMethod =
  'Customer canceled the hosted verification modal. Present them with other payment method type options.';

export default class FCHandler {
  private stripeInstance: any;
  private paymentInfo: PaymentInfo;

  constructor(paymentInfo: PaymentInfo) {
    this.paymentInfo = paymentInfo || {};
  }

  setupFinancialConnections(paymentIntent): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        getStripeV3(paymentIntent).then((stripeInstance) => {
          this.stripeInstance = stripeInstance;
          resolve(this.stripeInstance);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  getErrorObject(setupIntent): any {
    return {
      name: 'FC_requires_payment_method',
      code: 'FC_requires_payment_method',
      message: setupIntent.cancellation_reason || setupIntent.description || FCRequirePaymentMethod,
      type: ErrorType.GatewayError,
    };
  }

  collectBankAccountForSetup(actionPayload) {
    const {customer: {firstName = '', lastName = '', email = ''} = {}} = this.paymentInfo;
    return this.stripeInstance
      .collectBankAccountForSetup({
        clientSecret: actionPayload.client_secret,
        params: {
          payment_method_type: 'us_bank_account',
          payment_method_data: {
            billing_details: {
              name: lastName ? `${firstName} ${lastName}` : firstName,
              email,
            },
          },
        },
        expand: ['payment_method'],
      })
      .then((result) => {
        const {setupIntent, error} = result;
        if (error) {
          // PaymentMethod collection failed for some reason.
          throw new CbError(error);
        } else if (setupIntent.status === 'requires_payment_method') {
          // Customer canceled the hosted verification modal. Present them with other
          // payment method type options.
          throw new CbError(this.getErrorObject(setupIntent), setupIntent);
        } else if (setupIntent.status === 'requires_confirmation') {
          // We collected an account - possibly instantly verified, but possibly
          // manually-entered. Display payment method details and mandate text
          // to the customer and confirm the intent once they accept
          // the mandate.
          return setupIntent;
        }
      });
  }
}
