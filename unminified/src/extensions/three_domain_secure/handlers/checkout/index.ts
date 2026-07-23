import AbstractThreeDSecureHandler from '@/extensions/three_domain_secure/handlers/abstract';
import ThreeDSecureHandler from '@/extensions/three_domain_secure/index';
import {
  PaymentAttempt,
  PaymentAttemptStatus,
  PaymentIntentResponse,
  PaymentFlow,
} from '@/extensions/three_domain_secure/common/types';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {validateRawCardDetails} from '@/extensions/three_domain_secure/common/utils';

import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import Ids from '@/constants/ids';
import {Master as M} from '@/hosted_fields/common/enums';
import {ThreeDSPollingTimeouts} from '@/constants/enums';

export default class CheckoutCom3DSHandler extends AbstractThreeDSecureHandler {
  constructor(parent: ThreeDSecureHandler) {
    super(parent);
  }

  validate(): boolean {
    const hasRawCard = !!this.paymentInfo.card;
    const hasReferenceId = !!this.getReferenceId();
    const hasCardComponent = !!this.paymentInfo.cardComponent;
    const hadPaymentComponent = !!this.paymentInfo.paymentComponent;

    if (!hasRawCard && !hasReferenceId && !hasCardComponent && !hadPaymentComponent) {
      throw new CbError(Errors.missingCardDetails);
    }
    if (hasRawCard) {
      validateRawCardDetails(this.paymentInfo.card);
    }
    return true;
  }

  handlePayment(): void {
    Promise.resolve(true)
      .then(() => {
        let requestData: any = {
          ...this.paymentInfo,
          paymentMethod: this.paymentInfo.card,
          cardBillingAddress: this.getCardBillingAddress(),
          customerBillingAddress: this.getCustomerBillingAddress(),
          customer: this.getCustomerInfo(),
          plan: this.hasAdditionalData() && this.paymentInfo.additionalData.plan,
          shippingAddress: this.getShippingAddress(),
        };

        if (this.callbacks.challenge) {
          requestData.paymentFlow = PaymentFlow.REDIRECT;
        }

        return this.confirmPayment(requestData);
      })
      .catch((err) => {
        this.removeIframe();
        this.callError(err instanceof CbError ? err : new CbError(err));
      });
  }

  protected handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    return Promise.resolve(true).then(() => {
      switch (paymentAttempt.status) {
        case PaymentAttemptStatus.AUTHORIZED:
          this.callSuccess();
          return true;

        case PaymentAttemptStatus.REQUIRES_CHALLENGE:
          this.callChange();
          return this.do3DSVerification(paymentAttempt).then((data) => {
            if (this.callbacks.challenge) {
              const updatedIntent = data.additionalInfo.details.payment_intent;
              this.parent.setPaymentIntent(updatedIntent);
              return this.handlePaymentAttempt(this.getPaymentAttempt());
            }
            return this.confirmPayment(data);
          });

        case PaymentAttemptStatus.REFUSED:
        default:
          throw this.intentError();
      }
    });
  }

  private do3DSVerification(paymentAttempt: PaymentAttempt): Promise<any> {
    const rawData = paymentAttempt.action_payload;
    if (this.callbacks.challenge) {
      this.callbacks.challenge(rawData.redirect_url);
    } else {
      const iframe = this.createIframe();
      this.openIframe();
      iframe.src = rawData.redirect_url;
    }
    return this.pollFor3DSCompletion()
      .then((data: PaymentIntentResponse) => {
        return {
          additionalInfo: {
            details: data,
            paymentData: rawData.paymentData,
          },
        };
      })
      .finally(() => this.removeIframe());
  }

  protected pollFor3DSCompletion() {
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
}
