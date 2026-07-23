import Ids from '@/constants/ids';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import {Master as M} from '@/hosted_fields/common/enums';
import AbstractThreeDSecureHandler from '../abstract';
import {PaymentAttempt, PaymentAttemptStatus} from '@/plugins/three_domain_secure/types';
import {validateRawCardDetails} from '@/extensions/three_domain_secure/common/utils';

export default class IngenicoHandler extends AbstractThreeDSecureHandler {
  private iframe: HTMLIFrameElement;

  handlePayment() {
    this.handlePaymentFlow(this.getConfirmReqPayload());
  }

  handlePaymentFlow(payload) {
    return this.confirmPayment(payload)
      .catch((err) => {
        this.callError(err instanceof CbError ? err : new CbError(err));
      })
      .finally(() => {
        this.removeIframe();
      });
  }

  validate() {
    const hasRawCard = !!this.paymentInfo.card;
    const hasReferenceId = !!this.getReferenceId();
    const hasCbToken = !!this.paymentInfo.cbToken;
    const hasCardComponent = !!this.paymentInfo.cardComponent;
    const hadPaymentComponent = !!this.paymentInfo.paymentComponent;

    if (!hasRawCard && !hasReferenceId && !hasCbToken && !hasCardComponent && !hadPaymentComponent) {
      throw new CbError(Errors.missingIngenicoDirectPaymentInfo);
    }
    if (hasRawCard) {
      validateRawCardDetails(this.paymentInfo.card);
    }
    return true;
  }

  handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_CHALLENGE: {
        return this.doChallenge(paymentAttempt).then((data) => {
          this.setPaymentIntent(data.payment_intent);
          return this.handlePaymentAttempt(this.getPaymentAttempt());
        });
      }
      case PaymentAttemptStatus.AUTHORIZED: {
        this.callSuccess();
        return Promise.resolve(true);
      }

      case PaymentAttemptStatus.REFUSED:
      default: {
        throw this.intentError();
      }
    }
  }

  getBrowserFingerprint() {
    return {
      browserInfo: {
        colorDepth: screen.colorDepth,
        javaEnabled: navigator.javaEnabled(),
        language: navigator.language,
        screenHeight: screen.height,
        screenWidth: screen.width,
        timeZoneOffset: new Date().getTimezoneOffset(),
      },
    };
  }

  getConfirmReqPayload() {
    const browserInfo = this.getBrowserFingerprint();
    const paymentIntent = this.getPaymentIntent();
    if (paymentIntent && paymentIntent.reference_id) {
      return browserInfo;
    }

    let payload: any = {};
    const {card, cbToken, cardComponent, paymentComponent} = this.paymentInfo;
    if (card) {
      payload = {paymentMethod: card};
    } else if (cbToken) {
      payload = {cbToken};
    } else if (cardComponent) {
      payload = {cardComponent};
    } else if (paymentComponent) {
      payload = {paymentComponent};
    }

    if (this.hasAdditionalData()) {
      payload.cardBillingAddress = this.getCardBillingAddress();
      payload.billingAddress = this.getCardBillingAddress();
      payload.email = this.paymentInfo.additionalData.email;
    }
    return {...browserInfo, ...payload};
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
}
