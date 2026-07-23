import AbstractIDealHandler from '@/extensions/payments/iDeal/handlers/abstract';
import {Locale, Master as M} from '@/hosted_fields/common/enums';
import {PaymentAttemptStatus, PaymentAttempt} from '@/extensions/three_domain_secure/common/types';
import {CbError} from '@/hosted_fields/common/errors';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import Ids from '@/constants/ids';
import {gwJsonify} from '@/utils/utility-functions';
import IDealHandler from '@/extensions/payments/iDeal';
import {PaymentRedirectTimeouts} from '@/constants/enums';
import Utils from '@/utils/payments/utils';
import Helpers from '@/helpers';

export default class DefaultIdealHandler extends AbstractIDealHandler {
  private publishableKey: string;
  private component: any;
  private _selectedBank: any;

  constructor(parent: IDealHandler) {
    super(parent);
  }

  mountBankList(id: string, options?: any): Promise<any> {
    return this.parent.renderDefaultComponent(id, options);
  }

  getIssuerBank(): string {
    return (this.paymentInfo && this.paymentInfo.issuerBank) || this._selectedBank;
  }

  handlePayment() {
    const bankId = this.getIssuerBank();
    //if (!bankId) {
    //  this.callError(new CbError(Errors.missingIDealIssuerBank));
    //} else {
    let cbInstance = Helpers.getCbInstance();
    const customer = this.paymentInfo && this.paymentInfo.customer;
    this.handlePaymentFlow({
      paymentMethodType: 'ideal',
      params: {
        issuerBank: bankId,
        ownerEmail: Utils.getOwnerEmail(this.paymentInfo),
      },
      customerBillingAddress: customer && customer.billingAddress,
      customer: {
        firstName: customer && customer.firstName,
        lastName: customer && customer.lastName,
        email: customer && customer.email,
        companyName: customer && customer.company,
      },
      email: Utils.getOwnerEmail(this.paymentInfo),
      locale: cbInstance ? cbInstance.options.locale : Locale.en,
      paymentMethod: Utils.getPaymentMethodUserDetails(this.paymentInfo),
    });
    //}
  }

  handlePaymentFlow(payload) {
    return this.confirmPayment(payload).catch((error) => {
      // Check for error
      error = this.sanitizeError(error);
      this.callError(error);
    });
  }

  sanitizeError(error: any = {}) {
    this.kvl({
      ...gwJsonify(error),
      action: 'gateway_client_error',
      gw: (this.getPaymentIntent() && this.getPaymentIntent().gateway) || '',
    });
    if (error.errorCode) {
      return new CbError(
        {
          name: (error.errorCode + '').toUpperCase(),
          message: error.message,
          code: error.status,
          type: error.errorType,
        },
        error
      );
    } else {
      return new CbError(error, error);
    }
  }

  setClientConfig(config: any): void {
    this.publishableKey = config.publishable_key;
  }

  private redirectToBank(paymentAttempt: PaymentAttempt): Promise<any> {
    const rawData = paymentAttempt.action_payload;

    const redirectUrl = rawData.redirect_url;

    this.logRedirection(redirectUrl);

    if (this.parent.isRedirectMode && this.getPaymentIntent().success_url) {
      window.location.href = redirectUrl;
      return new Promise(() => {});
    }

    this.parent.windowManager.loadURL(redirectUrl);
    if (this.callbacks && this.callbacks.cancel) {
      this.parent.windowManager.watchClose(() => this.callbacks.cancel());
    }
    // this.parent.windowManager.watchClose(this.onBankTabClose.bind(this))

    return this.pollForIDealCompletion()
      .then((data) => {
        if (data['version_2']) {
          return data;
        }

        return {
          additionalInfo: {
            details: data,
            paymentData: rawData.paymentData,
          },
        };
      })
      .finally(() => {
        this.closeTab();
      });
  }

  handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    return Promise.resolve(true).then(() => {
      switch (paymentAttempt.status) {
        case PaymentAttemptStatus.AUTHORIZED: {
          this.callSuccess();
          return true;
        }

        case PaymentAttemptStatus.REQUIRES_CHALLENGE:
        case PaymentAttemptStatus.REQUIRES_REDIRECTION: {
          this.callChange();
          return this.redirectToBank(paymentAttempt).then((data) => {
            if (data['version_2']) {
              this.setPaymentIntent(data.payment_intent);
              return this.handlePaymentAttempt(this.getPaymentAttempt());
            } else {
              return this.confirmPayment(data);
            }
          });
        }

        case PaymentAttemptStatus.REFUSED:
        default: {
          throw this.intentError();
        }
      }
    });
  }

  private pollForIDealCompletion() {
    const paymentIntentId = this.getPaymentIntent().id;
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.PollPaymentIntent3DSResult,
          data: {paymentIntentId},
        },
        Ids.MASTER_FRAME,
        {timeout: PaymentRedirectTimeouts.IDEAL}
      )
    );
  }
}
