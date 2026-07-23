import AbstractThreeDSecureHandler from '@/extensions/three_domain_secure/handlers/abstract';
import ThreeDSecureHandler from '@/extensions/three_domain_secure/index';
import {
  ConfirmApiInputPayload,
  PaymentAttempt,
  PaymentAttemptStatus,
  PaymentMethodType,
} from '@/extensions/three_domain_secure/common/types';
import Errors, {CbError, ErrorType} from '@/hosted_fields/common/errors';
import {validateRawCardDetails} from '@/extensions/three_domain_secure/common/utils';

export default class VantivHandler extends AbstractThreeDSecureHandler {
  constructor(parent: ThreeDSecureHandler) {
    super(parent);
  }

  validate() {
    const hasRawCard = !!this.paymentInfo.card;
    const hasCardComponent = !!this.paymentInfo.cardComponent;
    const hasReferenceId = !!this.getReferenceId();
    const hadPaymentComponent = !!this.paymentInfo.paymentComponent;

    // Must have raw card, cardComponent, reference id or paymentComponent to process, else throw error
    if (!hasRawCard && !hasReferenceId && !hasCardComponent && !hadPaymentComponent) {
      throw new CbError(Errors.missingVantivPaymentInfo);
    }
    if (hasRawCard) {
      validateRawCardDetails(this.paymentInfo.card);
    }
    return true;
  }

  handlePayment() {
    this.handlePaymentFlow(this.getConfirmReqPayload());
  }

  getConfirmReqPayload() {
    let payload: any = {};
    const {card, cardComponent, paymentComponent} = this.paymentInfo;
    if (card) {
      payload = {
        paymentMethodType: PaymentMethodType.CARD,
        paymentMethodDetails: {card},
      };
    } else if (cardComponent) {
      payload = {cardComponent};
    } else if (paymentComponent) {
      payload = {paymentComponent};
    }
    return payload;
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

  handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
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
}
