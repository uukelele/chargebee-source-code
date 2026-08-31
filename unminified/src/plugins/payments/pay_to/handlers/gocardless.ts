import {PaymentAttemptStatus, PaymentAttempt, PaymentMethodType, Gateway} from '@/internal/payment-intent/types';
import PayToHandler from '@/plugins/payments/pay_to/handlers';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {requiredAll, requiredAnyOne} from '@/utils/utility-functions';
import {PaymentInfo, BankAccount, PayToDetails} from '../../faster_payments/types';
import BankFieldHelper from '@/utils/bank-field-helper';
import {PaymentOptions} from '@/hosted_fields/common/base-types';

export default class GocardlessPayToHandler extends PayToHandler {
  constructor(handler: PayToHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
  }

  validate(): Promise<boolean> {
    if (this._validate(this.paymentInfo)) {
      return Promise.resolve(true);
    } else {
      return Promise.reject(new CbError(Errors.invalidOrMissingPayToPaymentInfo));
    }
  }

  initPayment() {
    return Promise.resolve(this._transform(this.paymentInfo));
  }

  private redirectToBank(paymentAttempt: PaymentAttempt): Promise<any> {
    const rawData = paymentAttempt.action_payload;

    if (this.isRedirectMode && this.getPaymentIntent().success_url) {
      window.location.href = rawData.redirectUrl;
      return new Promise(() => {});
    }

    this.windowManager.loadURL(rawData.redirectUrl);
    this.windowManager.watchClose(() => this.callbackHandler.triggerCancelCallback());

    return this.pollForAuthCompletion();
  }

  private challengeFlow(paymentAttempt: PaymentAttempt): Promise<any> {
    return this.pollForAuthCompletion();
  }

  handlePayment(options: PaymentOptions | any): Promise<any> {
    return this.initiateAuthorization(options.paymentInfo, options.callbacks);
  }

  handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.PENDING_AUTHORIZATION:
        return this.challengeFlow(paymentAttempt).then((data) => {
          this.setPaymentIntent(data.payment_intent);
          return this.handlePaymentAttemptStatus(this.getPaymentAttempt().status);
        });
      case PaymentAttemptStatus.REQUIRES_REDIRECTION: {
        return this.redirectToBank(paymentAttempt).then((data) => {
          this.setPaymentIntent(data.payment_intent);
          return this.handlePaymentAttemptStatus(this.getPaymentAttempt().status);
        });
      }
      default: {
        return Promise.resolve(true);
      }
    }
  }

  _validate(input: PaymentInfo): boolean {
    if (input.useGateway) {
      return true;
    }
    let customer = input.customer;
    let billingAddress = customer && customer.billingAddress;
    return !!(
      customer &&
      requiredAnyOne(requiredAll(customer.firstName, customer.lastName), customer.company) &&
      requiredAll(
        customer.email,
        billingAddress,
        billingAddress.addressLine1,
        billingAddress.city,
        billingAddress.countryCode,
        billingAddress.zip,
        this._validatePayToIdentifier(input)
      )
    );
  }

  private _resolvePayToDetails(input: PaymentInfo): PayToDetails & {countryCode?: string} {
    const payTo = (input.additionalData && input.additionalData.payTo) || input.payTo;

    if (payTo) {
      return {
        payId: payTo.payId,
        accountNumber: payTo.accountNumber,
        bsbNumber: payTo.bsbNumber,
        countryCode: (input.bankAccount && input.bankAccount.countryCode) || 'AU',
      };
    }

    const bankAccount = input.bankAccount;
    if (!bankAccount) {
      return {};
    }

    return {
      payId: bankAccount.payId,
      accountNumber: bankAccount.accountNumber,
      bsbNumber: bankAccount.routingNumber,
      countryCode: bankAccount.countryCode || 'AU',
    };
  }

  private _validatePayToIdentifier(input: PaymentInfo): boolean {
    const {payId, accountNumber, bsbNumber, countryCode} = this._resolvePayToDetails(input);

    if (payId) {
      return true;
    }

    if (accountNumber || bsbNumber) {
      if (!accountNumber || !bsbNumber) {
        return false;
      }

      return this._validateBankFields({
        accountNumber,
        routingNumber: bsbNumber,
        countryCode: countryCode || 'AU',
      });
    }

    return false;
  }

  private _validateBankFields(givenBankAccount: BankAccount): boolean {
    const countryCode = givenBankAccount.countryCode || 'AU';
    if (!BankFieldHelper.isCountryForBecs(Gateway.GOCARDLESS, countryCode)) {
      return false;
    }
    let expectedBankFields = BankFieldHelper.getBecsFields(Gateway.GOCARDLESS, countryCode);
    return expectedBankFields.every((field) => givenBankAccount[field]);
  }

  _transform(input: PaymentInfo): object {
    const additionalData = input.additionalData;
    const subscription = additionalData && additionalData.subscription;
    let out: any = {
      paymentMethodType: PaymentMethodType.PAY_TO,
    };
    if (subscription) {
      out['subscription'] = {
        frequencyUnit: subscription.frequencyUnit,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        frequencyPeriod: subscription.frequencyPeriod,
        id: subscription.id,
        mandateFloorAmount: subscription.mandateFloorAmount,
      };
    }
    if (input.customer) {
      out['paymentMethodDetails'] = {
        firstName: input.customer.firstName,
        lastName: input.customer.lastName,
        companyName: input.customer.company,
        email: input.customer.email,
        billingAddress: input.customer.billingAddress,
      };
    }
    if (input.useGateway) {
      out['requiresRedirection'] = true;
    } else {
      const {payId, accountNumber, bsbNumber, countryCode} = this._resolvePayToDetails(input);

      if (payId) {
        out['paymentMethodDetails'] = {
          ...out['paymentMethodDetails'],
          payTo: {payId},
        };
      } else if (accountNumber && bsbNumber) {
        out['paymentMethodDetails'] = {
          ...out['paymentMethodDetails'],
          payTo: {
            accountNumber,
            bsbNumber,
          },
          directDebitBankAccount: {
            accountNumber,
            routingNumber: bsbNumber,
            accountCountry: countryCode || 'AU',
          },
        };
      }
    }
    return out;
  }
}
