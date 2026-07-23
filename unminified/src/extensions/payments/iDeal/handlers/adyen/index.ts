import AbstractIDealHandler from '@/extensions/payments/iDeal/handlers/abstract';
import {PaymentAttemptStatus, PaymentAttempt} from '@/extensions/three_domain_secure/common/types';
import {Master as M} from '@/hosted_fields/common/enums';
import {CbError} from '@/hosted_fields/common/errors';
import {jsonify, safeGet, gwJsonify} from '@/utils/utility-functions';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import Ids from '@/constants/ids';
import IDealHandler from '@/extensions/payments/iDeal';

// TODO: REFACTOR, move common types out from 3DS and update imports
import {Adyen} from '@/extensions/three_domain_secure/handlers/adyen/types';
import {PaymentRedirectTimeouts} from '@/constants/enums';

export default class AdyenIDealHandler extends AbstractIDealHandler {
  private component: any;
  private _paymentMethods: any;
  private _selectedBank: any;

  constructor(parent: IDealHandler) {
    super(parent);
  }

  setClientConfig(config) {}

  mountBankList(id: string, options?: any): Promise<any> {
    return this.parent.renderDefaultComponent(id, options);
  }

  getSelectedBank() {
    const bankId = this.getIssuerBank();
    return (
      bankId && {
        id: bankId,
        name: this.getBankName(bankId),
      }
    );
  }

  getBankName(bankId: string) {
    if (this._paymentMethods.paymentMethod && this._paymentMethods.paymentMethod === 'ideal') {
      const bankList = this._paymentMethods.issuers;
      if (bankList) {
        const bank = bankList.find((bank) => bank.id === bankId);
        return bank && bank.name;
      }
    } else {
      const iDealPayment = this._paymentMethods.find((method) => method.type === 'ideal');
      if (iDealPayment) {
        const bankList = iDealPayment.details.find((detail) => detail.key === 'issuer');
        if (bankList) {
          const bank = bankList.items.find((bank) => bank.id === bankId);
          return bank && bank.name;
        }
      }
    }
  }

  /**
   * Either get the issuer bank from paymentInfo set by the merchant or
   * from the component state
   */
  getIssuerBank(): string {
    return (this.paymentInfo && this.paymentInfo.issuerBank) || this._selectedBank;
  }

  handlePayment(): void {
    const bankId = this.getIssuerBank();
    // if (!bankId) {
    //  this.callError(new CbError(Errors.missingIDealIssuerBank));
    //} else {
    this.handlePaymentFlow({
      paymentMethodType: 'ideal',
      params: {
        issuerBank: bankId,
      },
    });
    //}
  }

  handlePaymentFlow(payload) {
    return this.confirmPayment(payload).catch((error) => {
      // Check for Adyen error
      error = this.sanitizeAdyenError(error);
      this.callError(error);
    });
  }

  sanitizeAdyenError(error: Adyen.Error = {}) {
    this.kvl({
      ...gwJsonify(error),
      action: 'gateway_client_error',
      gw: 'adyen',
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

  private redirectToBank(paymentAttempt: PaymentAttempt): Promise<any> {
    const rawData = paymentAttempt.action_payload;
    let redirectUrl;
    if (rawData.action) {
      redirectUrl = rawData.action.url;
    } else {
      redirectUrl = rawData.redirect.url;
    }

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

    return this.pollForAdyenIDealCompletion()
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
      .finally(() => this.closeTab());
  }

  private onBankTabClose() {
    this.stopAdyenIDealPoll({
      error: true,
      message: 'Bank window closed',
    });
  }

  private stopAdyenIDealPoll(data?: any) {
    const paymentIntentId = this.getPaymentIntent().id;
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.StopPollPaymentIntent3DSResult,
          data: {paymentIntentId, ...data},
        },
        Ids.MASTER_FRAME,
        {timeout: PaymentRedirectTimeouts.IDEAL}
      )
    );
  }

  private pollForAdyenIDealCompletion() {
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

  handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    return Promise.resolve(true).then(() => {
      switch (paymentAttempt.status) {
        case PaymentAttemptStatus.AUTHORIZED: {
          this.callSuccess();
          return true;
        }

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
}
