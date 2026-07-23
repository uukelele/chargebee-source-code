import AbstractThreeDSecureHandler from '@/extensions/three_domain_secure/handlers/abstract';
import ThreeDSecureHandler from '@/extensions/three_domain_secure/index';
import {
  PaymentAttempt,
  PaymentAttemptStatus,
  CardInfo,
  AdditionalData,
  StripePaymentIntentParams,
  PaymentIntentStatus,
  PaymentFlow,
  ConfirmApiInputPayload,
  PaymentInfo,
} from '@/extensions/three_domain_secure/common/types';
import Errors, {CbError, ErrorType} from '@/hosted_fields/common/errors';
import {validateRawCardDetails, loadScriptUsingPredicate} from '@/extensions/three_domain_secure/common/utils';
import {gwJsonify} from '@/utils/utility-functions';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import {Master as M} from '@/hosted_fields/common/enums';
import Ids from '@/constants/ids';
export default class Stripe3DSHandler extends AbstractThreeDSecureHandler {
  private stripeV3: any;
  private publishableKey: string;

  constructor(parent: ThreeDSecureHandler) {
    super(parent);
  }

  validate(): boolean {
    const hasElements = !!this.paymentInfo.element;
    const hasTokenizer = !!this.paymentInfo.tokenizer;
    const hasRawCard = !!this.paymentInfo.card;
    const hasReferenceId = !!this.getReferenceId();
    const hasCbToken = !!this.paymentInfo.cbToken;
    const hadPaymentComponent = !!this.paymentInfo.paymentComponent;

    if (!hasElements && !hasTokenizer && !hasRawCard && !hasReferenceId && !hasCbToken && !hadPaymentComponent) {
      throw new CbError(Errors.missingStripePaymentInfo);
    }

    if (hasRawCard) {
      validateRawCardDetails(this.paymentInfo.card);
    }

    if (hasElements && !this.parent.options.stripe) {
      throw new CbError(Errors.missingStripeInstance);
    }

    return true;
  }

  handlePayment(): void {
    this.checkNLoadScript()
      .then(() => {
        if (this.paymentInfo.element) {
          return this.elementFlow();
        } else if (this.paymentInfo.tokenizer) {
          return this.tokenizerFlow();
        } else if (this.paymentInfo.card) {
          return this.cardFlow();
        } else if (this.getReferenceId()) {
          return this.referenceIdFlow();
        } else if (this.paymentInfo.cbToken) {
          return this.cbTokenFlow();
        } else if (this.paymentInfo.paymentComponent) {
          return this.paymentComponentFlow();
        }
      })
      .then((success) => {
        this.callSuccess();
      })
      .catch((error) => {
        this.callError(error instanceof CbError ? error : new CbError(error));
      });
  }

  private paymentComponentFlow(): Promise<any> {
    return this.tokenizePaymentComponentCard({
      ...this.getAdditionalParams(),
      paymentIntent: this.getPaymentIntent(),
      paymentComponent: this.paymentInfo.paymentComponent,
      additionalData: this.paymentInfo.additionalData,
    }).then((payload: PaymentInfo) => {
      this.paymentInfo = payload;
      return this.cbTokenFlow();
    });
  }

  private elementFlow(): Promise<any> {
    return this.parent.options.stripe.createPaymentMethod('card', this.paymentInfo.element).then((result) => {
      if (result.error) {
        throw this.sanitizeStripeError(result.error);
      }
      return this.confirmPayment({
        paymentMethod: {id: result.paymentMethod.id},
      });
    });
  }

  // Info needed for Stripe INR to Intl. curr. txn
  private getAdditionalParams(): AdditionalData {
    let data: AdditionalData = {};
    const additionalData = this.paymentInfo.additionalData;
    if (additionalData) {
      data.cardBillingAddress = this.getCardBillingAddress();
      data.billingAddress = this.getCardBillingAddress();
      data.customerBillingAddress = this.getCustomerBillingAddress();
      data.shippingAddress = this.getShippingAddress();
      data.plan = additionalData.plan;
      data.customer = this.getCustomerInfo();
      data.mandate = this.getMandateInfo();
    }
    return data;
  }

  private tokenizerFlow(): Promise<any> {
    return this.paymentInfo.tokenizer().then((token) => {
      return this.confirmPayment({
        ...this.getAdditionalParams(),
        tmpToken: token,
      });
    });
  }

  private cbTokenFlow(): Promise<any> {
    const payload: ConfirmApiInputPayload = {
      ...this.getAdditionalParams(),
      cbToken: this.paymentInfo.cbToken,
    };

    if (this.paymentInfo.cardComponent) payload.cardComponent = this.paymentInfo.cardComponent;
    this.setPaymentFlow(payload);
    return this.confirmPayment(payload);
  }

  private setPaymentFlow(payload: ConfirmApiInputPayload) {
    if (this.callbacks.challenge) {
      payload.paymentFlow = PaymentFlow.REDIRECT;
    }
  }

  private cardFlow(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.getStripe().card.createToken(this.transformToStripeCard(this.paymentInfo.card), (status, response) => {
        if (response.error) {
          reject(this.sanitizeStripeError(response.error));
        }
        resolve({tmpToken: response.id});
      });
    }).then((pl: ConfirmApiInputPayload) => {
      this.setPaymentFlow(pl);
      const payload: ConfirmApiInputPayload = {
        ...this.getAdditionalParams(),
        ...pl,
      };
      return this.confirmPayment(payload);
    });
  }

  private referenceIdFlow(): Promise<any> {
    const pl: ConfirmApiInputPayload = {
      mandate: this.getMandateInfo(),
    };
    this.setPaymentFlow(pl);
    return this.confirmPayment(pl);
  }

  private handleAction(payload: any): Promise<any> {
    const isRedirectFlow = !!(payload.redirect_url && !this.getPaymentIntent().success_url && this.callbacks.challenge);

    if (isRedirectFlow) {
      return this.handleRedirectMode(payload);
    }

    if (payload && payload.obj_type === 'setup_intent') return this.stripeHandleCardSetup(payload);
    else return this.stripeHandleCardAction(payload);
  }

  /*
    Sends redirect URL to the parent window if opened within an iframe
  */
  private sendRedirectUrl(redirectURL: string) {
    // https://js.stripe.com, https://hooks.stripe.com,
    if (this.callbacks.challenge) {
      this.callbacks.challenge(redirectURL);
    }
  }

  private handleRedirectMode(payload: StripePaymentIntentParams): Promise<any> {
    // Sending a message to parent window, to handle the redirect
    this.sendRedirectUrl(payload.redirect_url);

    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.PollPaymentIntent3DSResult,
          data: {
            paymentIntentId: this.getPaymentIntent().id,
          },
        },
        Ids.MASTER_FRAME,
        {timeout: 10 * 60 * 1000}
      )
    );
  }

  private stripeHandleCardAction(payload: StripePaymentIntentParams) {
    return this.stripeV3.handleCardAction(payload.client_secret);
  }

  private stripeHandleCardSetup(payload) {
    return this.stripeV3.confirmCardSetup(payload.client_secret);
  }

  protected handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    return Promise.resolve(true).then(() => {
      if (paymentAttempt.status == PaymentAttemptStatus.REQUIRES_CHALLENGE) {
        this.callChange();
        let payload = paymentAttempt.action_payload;
        return this.handleAction(payload).then((result) => {
          if (result.error) {
            throw this.sanitizeStripeError(result.error);
          }

          if (result.payment_intent && result.payment_intent.status === PaymentIntentStatus.AUTHORIZED) {
            this.parent.setPaymentIntent(result.payment_intent);
            return true;
          }

          return this.confirmPayment();
        });
      } else if (paymentAttempt.status == PaymentAttemptStatus.AUTHORIZED) {
        return true;
      } else {
        throw this.intentError();
      }
    });
  }

  private getStripe(): any {
    return window['Stripe'];
  }

  private sanitizeStripeError(error) {
    if (!error) return new CbError();
    delete error.payment_method;
    this.kvl({
      ...gwJsonify(error),
      action: 'gateway_client_error',
      gw: 'stripe',
    });
    /**
     * {
     *  code: "payment_intent_authentication_failure"
     *  doc_url: "https://stripe.com/docs/error-codes/payment-intent-authentication-failure"
     *  message: "We are unable to authenticate your payment method. Please choose a different payment method and try again."
     *  payment_method: {id: "pm_1F5CDkBMHbSvNZGeLeojRHXn", object: "payment_method", billing_details: {…}, card: {…}, created: 1565273041, …}
     *  type: "invalid_request_error"
     * }
     */
    return new CbError(
      {
        name: error.code,
        type: ErrorType.GatewayError,
        message: error.message,
      },
      error
    );
  }

  private transformToStripeCard(card: CardInfo) {
    let fcard = {
      number: card.number,
      cvc: card.cvv,
      exp_month: card.expiryMonth,
      exp_year: card.expiryYear,
    };

    if (card.preferredScheme) {
      fcard['networks'] = {
        preferred: card.preferredScheme,
      };
    }

    if (card.firstName && card.lastName) {
      fcard['name'] = `${card.firstName} ${card.lastName}`;
    } else if (card.firstName && !card.lastName) {
      fcard['name'] = card.firstName;
    } else if (!card.firstName && card.lastName) {
      fcard['name'] = card.lastName;
    }
    if (this.paymentInfo.additionalData && this.paymentInfo.additionalData.billingAddress) {
      const billingAddr = this.paymentInfo.additionalData.billingAddress;
      let map = {
        addressLine1: 'address_line1',
        addressLine2: 'address_line2',
        city: 'address_city',
        state: 'address_state',
        stateCode: 'address_state',
        zip: 'address_zip',
        countryCode: 'address_country',
      };
      Object.keys(map).forEach((key) => {
        if (billingAddr[key]) {
          fcard[map[key]] = billingAddr[key];
        }
      });

      if (billingAddr.firstName || billingAddr.lastName)
        fcard['name'] = fcard['name'] || `${billingAddr.firstName || ''} ${billingAddr.lastName || ''}`.trim();
    }
    return fcard;
  }

  private isStripeV3Available() {
    let stripe = this.getStripe();
    return stripe && (stripe.version == 3 || stripe.StripeV3);
  }

  private isStripeV2Available() {
    let stripe = this.getStripe();
    return stripe && stripe.version == 2;
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

  private checkNLoadScript() {
    let promises: Promise<any>[] = [this.fetchPublishableKey()];
    let requiredJS = {
      v2: !this.isStripeV2Available(),
      v3: !!!this.isStripeV3Available(),
    };

    if (requiredJS.v2) {
      promises.push(
        loadScriptUsingPredicate('https://js.stripe.com/v2/', () => {
          return !!this.isStripeV2Available();
        })
      );
    }

    if (requiredJS.v3) {
      promises.push(
        loadScriptUsingPredicate('https://js.stripe.com/v3/', () => {
          return !!this.isStripeV3Available();
        })
      );
    }

    return new Promise((resolve, reject) => {
      Promise.all(promises)
        .then((args) => {
          this.getStripe().setPublishableKey(args[0]);
          this.stripeV3 = this.getStripe()(args[0]);
          resolve(true);
        })
        .catch((error) => {
          reject(new CbError(error));
        });
    });
  }
}
