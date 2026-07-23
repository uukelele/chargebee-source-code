import Errors, {CbError} from '@/hosted_fields/common/errors';
import AbstractThreeDSecureHandler from '../abstract';
import {validateRawCardDetails} from '@/extensions/three_domain_secure/common/utils';
import {PaymentAttempt, PaymentAttemptStatus, AdditionalData} from '@/plugins/three_domain_secure/types';
import {fetchPaymentIntentStatus} from '@/utils/payments/razorpay';

export default class Razorpay3DSHandler extends AbstractThreeDSecureHandler {
  validate(): boolean {
    const hasRawCard = !!this.paymentInfo.card;
    const hasReferenceId = !!this.getReferenceId();
    const hasCardComponent = !!this.paymentInfo.cardComponent;
    const hadPaymentComponent = !!this.paymentInfo.paymentComponent;
    if (!hasRawCard && !hasReferenceId && !hasCardComponent && !hadPaymentComponent) {
      throw new CbError(Errors.missingRazorPayPaymentInfo);
    }

    if (hasRawCard) {
      validateRawCardDetails(this.paymentInfo.card);

      if (!this.paymentInfo.card.firstName && !this.paymentInfo.card.lastName) {
        throw new CbError(Errors.missingRazorPayCardHolderInfo);
      } else if (!this.getCustomerInfo().email) {
        throw new CbError(Errors.missingRazorPayEmailInfo);
      } else if (!this.getCustomerInfo().phone) {
        throw new CbError(Errors.missingRazorPayPhoneInfo);
      }
    }
    return true;
  }

  getPaymentFlow(): Promise<any> {
    let paymentflow;
    if (this.paymentInfo.card) {
      paymentflow = this.cardFlow();
    } else if (this.getReferenceId()) {
      paymentflow = this.referenceIdFlow();
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
      data.paymentType = additionalData.paymentType;
    }
    if (!data.customer) {
      data.customer = {email: ''};
    } else if (data.customer && !data.customer.email) {
      data.customer.email = '';
    }
    return data;
  }

  cardFlow() {
    const payload = {
      paymentMethod: this.paymentInfo.card,
      ...this.getAdditionalParams(),
    };
    // To handle popup blocker
    this.openNewWindowForRazorpay();
    return this.confirmPayment(payload);
  }

  referenceIdFlow() {
    return this.confirmPayment({});
  }

  cardComponentFlow() {
    const payload: any = {
      ...this.getAdditionalParams(),
      cardComponent: this.paymentInfo.cardComponent,
    };
    // To handle popup blocker
    this.openNewWindowForRazorpay();
    return this.confirmPayment(payload);
  }

  paymentComponentFlow() {
    const payload: any = {
      ...this.getAdditionalParams(),
      paymentComponent: this.paymentInfo.paymentComponent,
    };
    // To handle popup blocker
    this.openNewWindowForRazorpay();
    return this.confirmPayment(payload);
  }

  protected handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_CHALLENGE:
        this.callChange();
        return this.redirectToBank(paymentAttempt).then((data) => {
          if (data['version_2']) {
            this.setPaymentIntent(data.payment_intent);
            return this.handlePaymentAttempt(this.getPaymentAttempt());
          } else {
            return this.confirmPayment(data);
          }
        });
      case PaymentAttemptStatus.AUTHORIZED:
        this.callSuccess();
        return Promise.resolve(true);
      case PaymentAttemptStatus.REFUSED:
        this.closeWindowIfOpen();
        throw this.intentError();
      default:
        throw this.intentError();
    }
  }

  private redirectToBank(paymentAttempt: PaymentAttempt): Promise<any> {
    const redirectUrl = paymentAttempt.action_payload.redirect_url;
    // CHKOUTENGG-44063: We can't support redirectMode here because razorpay doesn't have redirect support
    this.openNewWindowForRazorpay();
    this.parent.windowManager.loadURL(redirectUrl);
    this.parent.windowManager.watchClose(() => {
      fetchPaymentIntentStatus(this.getPaymentIntent());
      this.callCancel();
    });

    return this.pollFor3DSCompletion()
      .then((data) => {
        return data;
      })
      .finally(() => {
        // Remove tab
        this.closeWindowIfOpen();
      });
  }

  private openNewWindowForRazorpay() {
    this.parent.openNewWindow({
      closeCallback: () => fetchPaymentIntentStatus(this.getPaymentIntent()),
    });
  }
}
