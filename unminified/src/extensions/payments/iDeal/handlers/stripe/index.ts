import AbstractIDealHandler from '@/extensions/payments/iDeal/handlers/abstract';
import {PaymentAttemptStatus, PaymentAttempt} from '@/extensions/three_domain_secure/common/types';
import {Master as M} from '@/hosted_fields/common/enums';
import {CbError} from '@/hosted_fields/common/errors';
import {gwJsonify, safeGet} from '@/utils/utility-functions';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import Ids from '@/constants/ids';
import IDealHandler from '@/extensions/payments/iDeal';
import {loadScriptUsingPredicate} from '@/extensions/three_domain_secure/common/utils';

// TODO: REFACTOR, move common types out from 3DS and update imports
import {Adyen} from '@/extensions/three_domain_secure/handlers/adyen/types';
import {PaymentRedirectTimeouts} from '@/constants/enums';

declare var Chargebee;

export default class StripeIDealHandler extends AbstractIDealHandler {
  private stripeInstance: any;
  private publishableKey: string;
  private selectedBank: string;
  private component: any;

  constructor(parent: IDealHandler) {
    super(parent);
  }

  mountBankList(id: string, options: any): Promise<any> {
    let _this = this;
    return this.checkNLoadScript().then(() => {
      if (!this.component) {
        const component = this.stripeInstance.elements().create('idealBank', {
          style: {
            ...options.style,
            base: {
              ...options.style.base,
              padding: '12px 16px',
            },
          },
          hideIcon: true,
        });
        component.on('change', function (event) {
          _this.selectedBank = event.value;
        });
        this.component = {
          ...component,
          getSelectedBank() {
            return {
              id: _this.selectedBank,
            };
          },
        };
      } else {
        this.component.update({
          value: _this.selectedBank,
        });
      }
      this.component.mount(id);
      this.parent.component = this.component;
    });
  }

  private stopStripeIDealPoll(data?: any) {
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

  private pollForStripeIDealCompletion() {
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

  private getStripe(): any {
    return window['Stripe'];
  }

  private isStripeV3Available() {
    let stripe = this.getStripe();
    return stripe && (stripe.version == 3 || stripe.StripeV3);
  }

  private checkNLoadScript(): Promise<any> {
    let promises: Promise<any>[] = [
      this.fetchPublishableKey(),
      loadScriptUsingPredicate('https://js.stripe.com/v3/', () => {
        return !!this.isStripeV3Available();
      }),
    ];

    return new Promise<void>((resolve, reject) => {
      Promise.all(promises)
        .then((args) => {
          this.stripeInstance = this.getStripe()(args[0]);
          resolve();
        })
        .catch((error) => {
          reject(new CbError(error));
        });
    });
  }

  setClientConfig(config) {
    this.publishableKey = config.publishable_key;
  }

  private fetchPublishableKey() {
    if (this.publishableKey) {
      return Promise.resolve(this.publishableKey);
    }
    return this.fetchGatewayCredential().then((data) => {
      this.publishableKey = data.publishable_key;
      return Promise.resolve(this.publishableKey);
    });
  }

  //////////////////////

  getIssuerBank(): string {
    return this.paymentInfo && this.paymentInfo.issuerBank;
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
        ownerName: this.paymentInfo.userName,
        ownerEmail: this.paymentInfo.userEmail,
      },
      retainPaymentMethod: this.paymentInfo.retainPaymentMethod,
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

    return this.pollForStripeIDealCompletion()
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

  private onBankTabClose() {
    this.stopStripeIDealPoll({
      error: true,
      message: 'Bank window closed',
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
}
