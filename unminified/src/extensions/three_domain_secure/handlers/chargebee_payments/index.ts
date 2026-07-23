import AbstractThreeDSecureHandler from '@/extensions/three_domain_secure/handlers/abstract';
import ThreeDSecureHandler from '@/extensions/three_domain_secure';
import {PaymentAttempt} from '@/internal/payment-intent/types';
import {validateRawCardDetails} from '@/internal/common/utils';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {
  adyenHandlePaymentAttempt,
  createAdyenInstanceForChargebeePayments,
  handleCardpayment,
  sanitizeAdyenError,
} from '@/utils/payments/adyen';

export default class ChargebeePayments3DSHandler extends AbstractThreeDSecureHandler {
  private adyenClient: any;
  constructor(parent: ThreeDSecureHandler) {
    super(parent);
    this.adyenClient = this.parent.options.adyen;
  }
  validate(): boolean {
    const hasRawCardDetails = !!this.paymentInfo.card;
    const hasReferenceId = !!this.getReferenceId();
    const hasCardComponent = !!this.paymentInfo.cardComponent;
    const hadPaymentComponent = !!this.paymentInfo.paymentComponent;

    if (!hasRawCardDetails && !hasReferenceId && !hasCardComponent && !hadPaymentComponent) {
      throw new CbError(Errors.missingChargebeePaymentsPaymentInfo);
    }

    if (hasRawCardDetails) {
      validateRawCardDetails(this.paymentInfo.card);
    }

    return true;
  }

  handlePayment(): void {
    handleCardpayment(this)
      .then((payload) => this.createAdyenInstance().then(() => this.confirmPayment(payload)))
      .catch((error) => {
        error = sanitizeAdyenError(error, this);
        this.callError(error);
      });
  }

  protected handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    return adyenHandlePaymentAttempt(paymentAttempt, this, this.adyenClient);
  }

  private createAdyenInstance(): Promise<any> {
    let intent = this.getPaymentIntent();
    return createAdyenInstanceForChargebeePayments(intent, this).then(
      (adyenClient) => (this.adyenClient = adyenClient)
    );
  }
}
