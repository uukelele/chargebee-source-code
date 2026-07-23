import Errors, {CbError} from '@/hosted_fields/common/errors';
import AbstractThreeDSecureHandler from '../abstract';
import {validateRawCardDetails} from '@/extensions/three_domain_secure/common/utils';
import {PaymentAttempt, PaymentAttemptStatus, AdditionalData} from '@/plugins/three_domain_secure/types';

export default class Mollie3DSHandler extends AbstractThreeDSecureHandler {
  validate(): boolean {
    const hasRawCard = !!this.paymentInfo.card;
    const hasReferenceId = !!this.getReferenceId();
    const hasCbToken = !!this.paymentInfo.cbToken;
    const hasCardComponent = !!this.paymentInfo.cardComponent;
    const hadPaymentComponent = !!this.paymentInfo.paymentComponent;
    try {
      if (!hasRawCard && !hasReferenceId && !hasCbToken && !hasCardComponent && !hadPaymentComponent) {
        throw new CbError(Errors.missingMolliePaymentInfo);
      }
      if (hasRawCard) {
        validateRawCardDetails(this.paymentInfo.card);

        if (!this.paymentInfo.card.firstName && !this.paymentInfo.card.lastName) {
          throw new CbError(Errors.missingMollieCardHolderInfo);
        }
      }
    } catch (error) {
      this.closeWindowIfOpen();
      throw error;
    }
    return true;
  }

  getPaymentFlow(): Promise<any> {
    let paymentflow;
    if (this.paymentInfo.card) {
      paymentflow = this.cardFlow();
    } else if (this.getReferenceId()) {
      paymentflow = this.referenceIdFlow();
    } else if (this.paymentInfo.cbToken) {
      paymentflow = this.cbTokenFlow();
    } else if (this.paymentInfo.cardComponent) {
      paymentflow = this.cardComponentFlow();
    } else if (this.paymentInfo.paymentComponent) {
      paymentflow = this.paymentComponentFlow();
    }
    return paymentflow;
  }

  handlePayment() {
    const paymentflow = this.getPaymentFlow();
    if (paymentflow) {
      paymentflow
        .catch((err) => {
          this.callError(err instanceof CbError ? err : new CbError(err));
        })
        .finally(() => {
          this.closeWindowIfOpen();
        });
    }
  }

  closeWindowIfOpen() {
    this.parent && this.parent.closeTab();
  }

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
    }
    return data;
  }

  cardFlow() {
    const payload = {
      paymentMethod: this.paymentInfo.card,
      ...this.getAdditionalParams(),
    };
    // To handle popup blocker
    this.parent && this.parent.openNewWindow();
    return this.confirmPayment(payload);
  }

  referenceIdFlow() {
    return this.confirmPayment({});
  }

  cbTokenFlow() {
    const payload: any = {
      ...this.getAdditionalParams(),
      cbToken: this.paymentInfo.cbToken,
    };
    // To handle popup blocker
    this.parent && this.parent.openNewWindow();
    return this.confirmPayment(payload);
  }

  cardComponentFlow() {
    const payload: any = {
      ...this.getAdditionalParams(),
      cardComponent: this.paymentInfo.cardComponent,
    };
    // To handle popup blocker
    this.parent && this.parent.openNewWindow();
    return this.confirmPayment(payload);
  }

  paymentComponentFlow() {
    const payload: any = {
      ...this.getAdditionalParams(),
      paymentComponent: this.paymentInfo.paymentComponent,
    };
    // To handle popup blocker
    this.parent && this.parent.openNewWindow();
    return this.confirmPayment(payload);
  }

  protected handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_CHALLENGE:
        return this.doChallenge(paymentAttempt).then((data: any) => {
          this.setPaymentIntent(data.payment_intent);
          return this.handlePaymentAttempt(this.getPaymentAttempt());
        });
      case PaymentAttemptStatus.AUTHORIZED:
        this.callSuccess();
        return Promise.resolve(true);
      case PaymentAttemptStatus.REFUSED:
      default:
        throw this.intentError();
    }
  }

  private doChallenge(paymentAttempt: PaymentAttempt): Promise<any> {
    const redirectUrl = paymentAttempt.action_payload.redirect_url;
    // Do page redirect as success_url is present at intent
    if (this.parent.hasReturnUrlAtIntent()) {
      window.location.href = redirectUrl;
      return new Promise(() => {});
    }
    this.parent.openNewWindow();
    this.parent.windowManager.loadURL(redirectUrl);
    return this.pollFor3DSCompletion()
      .then((data) => {
        return data;
      })
      .finally(() => {
        // Remove tab
        this.parent.closeTab();
      });
  }
}
