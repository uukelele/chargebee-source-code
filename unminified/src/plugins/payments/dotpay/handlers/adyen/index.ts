import AbstractDotpayHandler from '@/plugins/payments/dotpay/handlers/abstract';
import {PaymentAttemptStatus, PaymentAttempt} from '@/extensions/three_domain_secure/common/types';
import {Master as M} from '@/hosted_fields/common/enums';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {gwJsonify, safeGet} from '@/utils/utility-functions';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import Ids from '@/constants/ids';
import DotpayHandler from '@/plugins/payments/dotpay/handlers';

// TODO: REFACTOR, move common types out from 3DS and update imports
import {Adyen} from '@/extensions/three_domain_secure/handlers/adyen/types';
import {ThreeDSPollingTimeouts} from '@/constants/enums';

export default class AdyenDotpayHandler extends AbstractDotpayHandler {
  constructor(parent: DotpayHandler) {
    super(parent);
  }

  handlePayment(): void {
    this.handlePaymentFlow({
      paymentMethodType: 'dotpay',
      params: {
        issuerBank: this.paymentInfo.issuerBank,
      },
    });
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
    if (this.parent.isRedirectMode && this.getPaymentIntent().success_url) {
      window.location.href = redirectUrl;
      return new Promise(() => {});
    }

    this.parent.windowManager.loadURL(redirectUrl);
    // this.parent.windowManager.watchClose(this.onBankTabClose.bind(this))

    return this.pollForAdyenDotpayCompletion().then((data) => {
      // Remove tab
      this.closeTab();

      if (data['version_2']) {
        return data;
      }

      return {
        additionalInfo: {
          details: data,
          paymentData: rawData.paymentData,
        },
      };
    });
  }

  private onBankTabClose() {
    this.stopAdyenDotpayPoll({
      error: true,
      message: 'Bank window closed',
    });
  }

  private stopAdyenDotpayPoll(data?: any) {
    const paymentIntentId = this.getPaymentIntent().id;
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.StopPollPaymentIntent3DSResult,
          data: {paymentIntentId, ...data},
        },
        Ids.MASTER_FRAME,
        {timeout: 120000}
      )
    );
  }

  private pollForAdyenDotpayCompletion() {
    const paymentIntentId = this.getPaymentIntent().id;
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.PollPaymentIntent3DSResult,
          data: {paymentIntentId},
        },
        Ids.MASTER_FRAME,
        {timeout: ThreeDSPollingTimeouts.DEFAULT}
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
