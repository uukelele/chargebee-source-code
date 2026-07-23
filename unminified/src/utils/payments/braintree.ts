import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import {loadScript, loadScriptUsingPredicate} from '@/internal/common/utils';
import {PaymentIntent} from '@/internal/payment-intent/types';
import {Master as M} from '@/hosted_fields/common/enums';
import Ids from '@/constants/ids';
import {Braintree} from '@/extensions/three_domain_secure/handlers/braintree/types';
import Errors, {CbError} from '@/hosted_fields/common/errors';

declare global {
  interface Window {
    braintree: {
      client?: {
        create?: Function;
        VERSION?: string;
      };
      googlePayment?: {
        create?: Function;
      };
      threeDSecure?: {
        create?: Function;
      };
      dataCollector?: {
        create?: Function;
      };
      paypalCheckout?: {
        create?: Function;
      };
      venmo?: {
        create?: Function;
      };
      applePay?: {
        create?: Function;
      };
      usBankAccount?: {
        create?: Function;
      };
    };
  }
}

const BraintreeUtils = {
  VERSION: '3.96.1',

  braintree() {
    return window.braintree;
  },

  loadPaypal(): Promise<boolean> {
    if (this.braintree() && !this.braintree().paypalCheckout) {
      return loadScriptUsingPredicate(
        `https://js.braintreegateway.com/web/${this.braintree().client.VERSION}/js/paypal-checkout.min.js`,
        () => !!this.braintree().paypalCheckout
      );
    }
    return Promise.resolve(true);
  },

  loadBraintreeJS(): Promise<boolean> {
    if (!this.braintree()) {
      return loadScript(`https://js.braintreegateway.com/web/${this.VERSION}/js/client.min.js`, 'braintree');
    }
    return Promise.resolve(true);
  },

  loadAchJs(): Promise<boolean> {
    if (this.braintree() && !this.braintree().usBankAccount) {
      return loadScriptUsingPredicate(
        `https://js.braintreegateway.com/web/${this.braintree().client.VERSION}/js/us-bank-account.min.js`,
        () => !!this.braintree().usBankAccount
      );
    }
    return Promise.resolve(true);
  },

  loadApplePay(): Promise<boolean> {
    if (this.braintree() && !this.braintree().applePay) {
      return loadScriptUsingPredicate(
        `https://js.braintreegateway.com/web/${this.braintree().client.VERSION}/js/apple-pay.min.js`,
        () => !!this.braintree().applePay
      );
    }
    return Promise.resolve(true);
  },

  loadDataCollector(): Promise<boolean> {
    if (this.braintree() && !this.braintree().dataCollector) {
      return loadScriptUsingPredicate(
        `https://js.braintreegateway.com/web/${this.braintree().client.VERSION}/js/data-collector.min.js`,
        () => !!this.braintree().dataCollector
      );
    }
    return Promise.resolve(true);
  },

  initializeDataCollector(clientInstance: any): Promise<any> {
    return this.loadDataCollector().then(() =>
      this.braintree().dataCollector.create({
        client: clientInstance,
      })
    );
  },

  generateClientToken(paymentIntent: PaymentIntent): Promise<any> {
    if (!paymentIntent) Promise.resolve(null);
    const paymentIntentId = paymentIntent.id;
    const referenceId = paymentIntent.reference_id;
    const payload: any = {
      paymentIntentId,
    };

    if (referenceId) payload.referenceId = referenceId;

    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.GenerateBraintreeClientToken,
          data: payload,
        },
        Ids.MASTER_FRAME,
        {timeout: 10000}
      )
    );
  },

  initializeBraintreeClient(paymentIntent: PaymentIntent): Promise<any> {
    return this.loadBraintreeJS()
      .then(() => this.generateClientToken(paymentIntent))
      .then((resp: Braintree.ClientTokenResponse) => {
        return this.braintree().client.create({
          authorization: resp.client_token,
        });
      });
  },

  createBraintree3dsInstance(braintreeInstance) {
    return this.braintree().threeDSecure.create({
      version: 2,
      client: braintreeInstance,
    });
  },

  doCardVerification(
    data: Braintree.TokenizedCard,
    params: Braintree.ThreeDSParams,
    challengeRequested: boolean,
    braintree3DSInstance
  ) {
    params.nonce = data.nonce;
    const regulationEnvironment = data.authenticationInsight && data.authenticationInsight.regulationEnvironment;
    if (data.details) params.bin = data.details.bin;
    params.onLookupComplete = function (data: Braintree.LookupParams, next: Function) {
      // TODO onLookupComplete callback
      next();
    };

    if (challengeRequested || regulationEnvironment === Braintree.REGULATION_ENVIRONMENT.PSD2) {
      params.challengeRequested = true;
    }
    // https://braintree.github.io/braintree-web/current/ThreeDSecure.html#verifyCard
    return braintree3DSInstance.verifyCard(params).then((resp: Braintree.VerifyResponse) => {
      if (resp.liabilityShiftPossible && !resp.liabilityShifted) {
        return Promise.reject(new CbError(Errors.failedBraintreeThreeDSecureAuth));
      }
      return resp;
    });
  },
};

export default BraintreeUtils;
