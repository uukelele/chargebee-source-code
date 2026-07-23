import Errors, {CbError} from '@/hosted_fields/common/errors';
import AbstractThreeDSecureHandler from '../abstract';
import {PaymentAttempt, PaymentAttemptStatus} from '@/plugins/three_domain_secure/types';
import {validateRawCardDetails, loadScriptWithoutPredicate} from '@/extensions/three_domain_secure/common/utils';
import Helpers from '@/helpers';

export default class bankOfAmerica3DSHandler extends AbstractThreeDSecureHandler {
  private gatewayCredential;

  validate() {
    const hasRawCard = !!this.paymentInfo.card;
    const hasReferenceId = !!this.getReferenceId();
    const hasCardComponent = !!this.paymentInfo.cardComponent;
    const hadPaymentComponent = !!this.paymentInfo.paymentComponent;
    // Must have raw card, cardComponent or reference id to process, else throw error
    if (!hasRawCard && !hasReferenceId && !hasCardComponent && !hadPaymentComponent) {
      throw new CbError(Errors.missingBankOfAmericaPaymentInfo);
    }

    if (hasReferenceId) return true;
    if (hasRawCard) {
      validateRawCardDetails(this.paymentInfo.card);
    }
    // For raw card details, email should be present.
    if (!this.hasAdditionalData() || !this.paymentInfo.additionalData.email) {
      throw new CbError(Errors.missingBankOfAmericaEmailInfo);
    }

    return true;
  }

  preloadConfig() {
    if (this.gatewayCredential) {
      return Promise.resolve(this.gatewayCredential);
    }
    return this.fetchGatewayCredential().then((data) => {
      this.gatewayCredential = data;
      return data;
    });
  }

  handlePayment() {
    this.preloadConfig().then((data) => {
      const uuid = Helpers.genUuid();
      this.doDeviceDataCollection(`${data.merchant_id}${uuid}`, () =>
        this.handlePaymentFlow(this.getConfirmReqPayload(uuid))
      );
    });
  }

  handlePaymentFlow(payload) {
    return this.confirmPayment(payload).catch((err) => {
      this.callError(err instanceof CbError ? err : new CbError(err));
    });
  }

  handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.AUTHORIZED:
        this.callSuccess();
        return Promise.resolve(true);
      case PaymentAttemptStatus.REFUSED:
      default:
        throw this.intentError();
    }
  }

  getConfirmReqPayload(sessionId: string) {
    const {card, additionalData = {}, cardComponent, paymentComponent} = this.paymentInfo;
    const payload = {
      email: additionalData.email,
    };
    const paymentIntent = this.getPaymentIntent();
    if (paymentIntent && paymentIntent.reference_id) {
      return payload;
    }
    const billingAddress = this.getCardBillingAddress();
    if (billingAddress) {
      payload['cardBillingAddress'] = Object.assign({}, billingAddress, {
        country: billingAddress.countryCode,
        state: billingAddress.state || billingAddress.stateCode,
      });
    }
    if (cardComponent) {
      payload['cardComponent'] = cardComponent;
    } else if (card) {
      payload['paymentMethod'] = card;
    } else if (paymentComponent) {
      payload['paymentComponent'] = paymentComponent;
    }
    payload['additionalInfo'] = sessionId ? {fraudSessionId: sessionId} : {};
    return payload;
  }

  doDeviceDataCollection(fingerPrintId, callback) {
    loadScriptWithoutPredicate(
      `https://h.online-metrix.net/fp/tags.js?org_id=${this.gatewayCredential.org_id}&session_id=${fingerPrintId}`,
      callback,
      callback
    );
  }
}
