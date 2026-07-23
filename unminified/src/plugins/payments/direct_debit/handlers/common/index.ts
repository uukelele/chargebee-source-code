import DirectDebitHandler from '@/plugins/payments/direct_debit/handlers';
import {DirectDebitDataManager} from '../../helper/direct-debit-data-manager';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {PaymentAttemptStatus, PaymentAttempt, Gateway} from '@/internal/payment-intent/types';
import {PaymentOptions} from '@/hosted_fields/common/base-types';
import Helpers from '@/helpers/index';
import {Master as M} from '@/hosted_fields/common/enums';
import {jsonify} from '@/utils/utility-functions';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import Ids from '@/constants/ids';

/**
 * Gateways that require redirect-based authorization flow.
 * These gateways redirect the user to an external page for mandate signing/authentication.
 * All other gateways use direct API calls without redirection.
 */
const REDIRECT_BASED_GATEWAYS: string[] = ['twikey'];

export default class CommonDirectDebitHandler extends DirectDebitHandler {
  constructor(handler: DirectDebitHandler, ...args) {
    super(...args);
    if (handler) {
      this.windowManager = handler.windowManager;
      this.isRedirectMode = handler.isRedirectMode;
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

  private isRedirectBasedGateway(): boolean {
    const gateway = this.getPaymentIntent().gateway;
    return REDIRECT_BASED_GATEWAYS.includes(gateway);
  }

  private getRedirectUrl(paymentAttempt: PaymentAttempt): string | null {
    const actionPayload = paymentAttempt.action_payload || {};
    return actionPayload.redirect_url || null;
  }

  private redirectFlow(redirectUrl: string): Promise<any> {
    if (this.isRedirectMode && this.getPaymentIntent().success_url) {
      window.location.href = redirectUrl;
      return new Promise(() => {});
    }

    if (this.windowManager) {
      this.windowManager.loadURL(redirectUrl);
      return this.pollForAuthCompletion();
    }

    // Fallback: full page redirect
    window.location.href = redirectUrl;
    return new Promise(() => {});
  }

  handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_IDENTIFICATION:
      case PaymentAttemptStatus.REQUIRES_CHALLENGE:
      case PaymentAttemptStatus.REQUIRES_REDIRECTION: {
        const redirectUrl = this.getRedirectUrl(paymentAttempt);

        if (this.isRedirectBasedGateway() && redirectUrl) {
          return this.redirectFlow(redirectUrl).then((data) => {
            this.setPaymentIntent(data.payment_intent);
            return this.handlePaymentAttempt(this.getPaymentAttempt());
          });
        }

        throw new CbError(Errors.unknownPaymentAttemptStatus);
      }
      default: {
        return Promise.resolve(true);
      }
    }
  }

  protected getMetadata(): any {
    let achInfo = {};
    const intent = this.getPaymentIntent();
    const attempt = this.getPaymentAttempt();

    if (intent) {
      Object.assign(achInfo, {
        paymentIntent: {
          id: intent.id,
          status: intent.status,
          gatewayName: intent.gateway,
          gatewayAccountId: intent.gateway_account_id,
        },
      });
    }

    if (attempt) {
      Object.assign(achInfo, {
        paymentAttempt: {
          id: attempt.id,
          status: attempt.status,
          actionPayloadPresent: !!attempt.action_payload,
        },
      });
    }

    const data = {
      site_meta: Helpers.getSiteMetaData(),
      ach_meta: achInfo,
    };

    return data;
  }

  protected kvl(data): Promise<unknown> {
    const payload = {
      ...jsonify(data),
      ...this.getMetadata(),
    };
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.CaptureKVL,
          data: payload,
        },
        Ids.MASTER_FRAME
      )
    );
  }
}
