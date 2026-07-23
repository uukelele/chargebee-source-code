import Errors, {CbError} from '@/hosted_fields/common/errors';
import AbstractThreeDSecureHandler from '@/extensions/three_domain_secure/handlers/abstract';

import {Address, PaymentAttempt, PaymentAttemptStatus, PaymentMethodType} from '@/plugins/three_domain_secure/types';
import ThreeDSecureHandler from '@/extensions/three_domain_secure/index';
import {validateRawCardDetails} from '@/internal/common/utils';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import {Master as M} from '@/hosted_fields/common/enums';
import Ids from '@/constants/ids';
import {ThreeDSPollingTimeouts} from '@/constants/enums';
import Utils from '@/utils/payments/utils';

export default class PayCom3dsHandler extends AbstractThreeDSecureHandler {
  private iframe: HTMLIFrameElement;
  constructor(parent: ThreeDSecureHandler) {
    super(parent);
  }
  validate() {
    const hasRawCard = !!this.paymentInfo.card;
    const hasReferenceId = !!this.getReferenceId();
    const hasCardComponent = !!this.paymentInfo.cardComponent;
    const hasCbToken = !!this.paymentInfo.cbToken;
    const hadPaymentComponent = !!this.paymentInfo.paymentComponent;
    // Must have raw card, cardComponent or reference id or cbToken to process, else throw error
    if (!hasRawCard && !hasReferenceId && !hasCardComponent && !hasCbToken && !hadPaymentComponent) {
      throw new CbError(Errors.missingPayComPaymentInfo);
    }
    if (hasRawCard) {
      validateRawCardDetails(this.paymentInfo.card);
    }
    return true;
  }

  handlePayment(): void {
    const flow = this.handlePaymentFlow();
    if (flow) {
      flow
        .catch((err) => {
          this.callError(err instanceof CbError ? err : new CbError(err));
        })
        .finally(() => {
          this.closeWindowIfOpen();
        });
    }
  }

  handlePaymentFlow() {
    if (this.paymentInfo.card) {
      return this.cardFlow();
    } else if (this.getReferenceId()) {
      return this.referenceIdFlow();
    } else if (this.paymentInfo.cardComponent) {
      return this.cardComponentFlow();
    } else if (this.paymentInfo.paymentComponent) {
      return this.paymentComponentFlow();
    } else if (this.paymentInfo.cbToken) {
      return this.cbTokenFlow();
    }
  }

  cardFlow() {
    let requestData = this.getConfirmPayload(this.paymentInfo);
    return this.confirmPayment(requestData);
  }

  referenceIdFlow(): any {
    let payload = this.getConfirmPayload({});
    return this.confirmPayment(payload);
  }

  cardComponentFlow(): any {
    let payload = this.getConfirmPayload({
      cardComponent: this.paymentInfo.cardComponent,
    });
    return this.confirmPayment(payload);
  }

  paymentComponentFlow(): any {
    let payload = this.getConfirmPayload({
      paymentComponent: this.paymentInfo.paymentComponent,
    });
    return this.confirmPayment(payload);
  }

  cbTokenFlow(): any {
    let payload = this.getConfirmPayload({
      cbToken: this.paymentInfo.cbToken,
    });
    return this.confirmPayment(payload);
  }

  closeWindowIfOpen() {
    this.parent && this.parent.closeTab();
  }

  getConfirmPayload(paymentData: any): any {
    let custBillingAddress: Address = this.getCustomerBillingAddress() || {};
    let pmBillingAddress: Address = this.getCardBillingAddress() || {};
    let additionalMetaData: {} = this.getAdditionalMetaData();
    let payload = {
      paymentMethodType: PaymentMethodType.CARD,
      customer: {
        ...(this.getCustomerInfo() ? this.getCustomerInfo() : {}),
        firstName: custBillingAddress.firstName,
        lastName: custBillingAddress.lastName,
        billingAddress: custBillingAddress,
      },
      shippingAddress: this.getShippingAddress(),
      ...Utils.getBrowserFingerprint(),
      paymentMethodDetails: {
        ...paymentData,
        firstName: pmBillingAddress.firstName,
        lastName: pmBillingAddress.lastName,
        billingAddress: pmBillingAddress,
      },
      additionalInfo: {
        metaData: additionalMetaData,
      },
    };
    return payload;
  }

  protected handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    return Promise.resolve(true).then(() => {
      switch (paymentAttempt.status) {
        case PaymentAttemptStatus.AUTHORIZED:
          this.callSuccess();
          return true;

        case PaymentAttemptStatus.REQUIRES_CHALLENGE:
          this.callChange();
          return this.doChallenge(paymentAttempt).then((data) => {
            this.setPaymentIntent(data.payment_intent);
            return this.handlePaymentAttempt(this.getPaymentAttempt());
          });

        case PaymentAttemptStatus.REFUSED:
        default:
          throw this.intentError();
      }
    });
  }

  doChallenge(paymentAttempt: PaymentAttempt): Promise<any> {
    const rawResponse = paymentAttempt.action_payload;

    this.iframe = this.createIframe();
    this.openIframe();
    this.iframe.src = rawResponse.redirect_url;

    setTimeout(() => this.hideIframeLoader(), 1000);

    return this.pollFor3DSCompletion().then((data) => {
      this.removeIframe();
      return data;
    });
  }

  protected pollFor3DSCompletion() {
    const paymentIntentId = this.getPaymentIntent().id;
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.PollCheckoutCom3DS,
          data: {paymentIntentId},
        },
        Ids.MASTER_FRAME,
        {timeout: ThreeDSPollingTimeouts.DEFAULT}
      )
    );
  }
}
