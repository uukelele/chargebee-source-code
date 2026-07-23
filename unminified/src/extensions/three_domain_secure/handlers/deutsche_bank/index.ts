import ThreeDSecureHandler from '@/extensions/three_domain_secure/index';
import AbstractThreeDSecureHandler from '@/extensions/three_domain_secure/handlers/abstract';
import Errors, {CbError} from '@/hosted_fields/common/errors';

import {validateRawCardDetails} from '@/extensions/three_domain_secure/common/utils';

import {
  PaymentAttempt,
  PaymentAttemptStatus,
  PaymentIntentResponse,
  PaymentMethodType,
} from '@/extensions/three_domain_secure/common/types';
import Utils from '@/utils/payments/utils';

type ChallengeWindowSize = '01' | '02' | '03' | '04' | '05';

type ThreeDS2ChallengePayload = {
  acs_url: string;
  creq: string;
  PaReq: string;
  method_request: string;
  method_url: string;
  challengeWindowSize?: ChallengeWindowSize;
  paymentData?: string;
};

export default class DeutscheBank3DSHandler extends AbstractThreeDSecureHandler {
  constructor(parent: ThreeDSecureHandler) {
    super(parent);
  }

  validate(): boolean {
    const hasRawCard = !!this.paymentInfo.card;
    const hasReferenceId = !!this.getReferenceId();
    const hasCardComponent = !!this.paymentInfo.cardComponent;
    const hasPaymentComponent = !!this.paymentInfo.paymentComponent;

    if (!hasRawCard && !hasReferenceId && !hasCardComponent && !hasPaymentComponent) {
      throw new CbError(Errors.missingCardDetails);
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

  closeWindowIfOpen() {
    this.parent && this.parent.closeTab();
  }

  getConfirmPayload(paymentData: any): any {
    let custBillingAddress = this.getCustomerBillingAddress() || {};
    let pmBillingAddress = this.getCardBillingAddress() || {};

    let payload = {
      paymentMethodType: PaymentMethodType.CARD,
      ...Utils.getBrowserFingerprint(),
      customer: {
        ...(this.getCustomerInfo() ? this.getCustomerInfo() : {}),
        firstName: custBillingAddress.firstName,
        lastName: custBillingAddress.lastName,
        billingAddress: custBillingAddress,
      },
      shippingAddress: this.getShippingAddress(),
      paymentMethodDetails: {
        ...paymentData,
        firstName: pmBillingAddress.firstName,
        lastName: pmBillingAddress.lastName,
        billingAddress: pmBillingAddress,
      },
    };
    return payload;
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

  protected async handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.AUTHORIZED:
        this.callSuccess();
        return Promise.resolve(true);

      case PaymentAttemptStatus.REQUIRES_IDENTIFICATION:
        this.callChange();
        return this.methodRequired3DSVerification(paymentAttempt).then((data) => {
          const updatedIntent =
            data && data.additionalInfo && data.additionalInfo.details && data.additionalInfo.details.payment_intent;
          if (this.callbacks.challenge && updatedIntent) {
            this.parent.setPaymentIntent(updatedIntent);
            return this.handlePaymentAttempt(this.getPaymentAttempt());
          }
          return this.handlePaymentAttempt(data);
        });

      case PaymentAttemptStatus.REQUIRES_CHALLENGE:
        this.callChange();
        return this.do3DSVerification(paymentAttempt).then((data) => {
          const updatedIntent =
            data && data.additionalInfo && data.additionalInfo.details && data.additionalInfo.details.payment_intent;

          if (this.callbacks.challenge && updatedIntent) {
            this.parent.setPaymentIntent(updatedIntent);
            return this.handlePaymentAttempt(this.getPaymentAttempt());
          }
          return this.handlePaymentAttempt(data);
        });

      case PaymentAttemptStatus.REFUSED:
      default:
        throw this.intentError();
    }
  }
  private buildAndPostFormToIframe(iframe: HTMLIFrameElement, actionUrl: string, fields: Record<string, string>) {
    if (!iframe.name) iframe.name = `acs_target_${Date.now()}`;

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = actionUrl;
    form.target = iframe.name;

    Object.entries(fields).forEach(([k, v]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = k;
      input.value = v;
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
    form.remove();
  }

  private buildAndPostFormToHiddenIframe(iframe: HTMLIFrameElement, methodUrl: string, fields: Record<string, string>) {
    if (!iframe.name) iframe.name = `acs_target_${Date.now()}`;

    const form = document.createElement('form');
    form.style.display = 'none';
    form.name = 'tdsMethodForm';
    form.method = 'POST';
    form.action = methodUrl;
    form.target = iframe.name;

    Object.entries(fields).forEach(([k, v]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = k;
      input.value = v;
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
    form.remove();
  }

  private openMethodInIframe(methodUrl: string, methodRequest: string) {
    // const iframe = this.createHiddenIframe(`acs_target_${Date.now()}`);
    const iframe = this.createIframe();
    iframe.width = 0 as any;
    iframe.height = 0 as any;
    iframe.style.display = 'none';
    if (!iframe.name) iframe.name = `tds_method_${Date.now()}`;
    return this.buildAndPostFormToHiddenIframe(iframe, methodUrl, {threeDSMethodData: methodRequest});
  }

  private openChallengeInIframe(acsUrl: string, creq: string, challengeWindowSize?: ChallengeWindowSize) {
    const iframe = this.createIframe();

    if (!iframe.name) iframe.name = `acs_target_${Date.now()}`;

    if (challengeWindowSize) {
      this.setChallengeWindowSize(iframe, challengeWindowSize);
    }

    this.openIframe();
    this.buildAndPostFormToIframe(iframe, acsUrl, {creq, threeDSSessionData: creq});
  }

  private methodRequired3DSVerification(paymentAttempt: PaymentAttempt): Promise<any> {
    const rawData = paymentAttempt.action_payload as
      | ThreeDS2ChallengePayload
      | (Record<string, any> & Partial<ThreeDS2ChallengePayload>);

    if (rawData && 'method_url' in rawData && rawData.method_url && rawData.method_request) {
      this.openMethodInIframe(rawData.method_url, rawData.method_request);
    }

    return this.pollFor3DSCompletionForPendingAuthorization()
      .then((data: PaymentIntentResponse) => {
        return {...data.payment_intent.active_payment_attempt, action_payload: data.openpay_action_payload};
      })
      .finally(() => this.removeIframe());
  }

  private do3DSVerification(paymentAttempt: PaymentAttempt): Promise<any> {
    const rawData = paymentAttempt.action_payload as
      | ThreeDS2ChallengePayload
      | (Record<string, any> & Partial<ThreeDS2ChallengePayload>);

    if (rawData && 'acs_url' in rawData && rawData.acs_url && rawData.creq) {
      this.openChallengeInIframe(
        rawData.acs_url,
        rawData.creq,
        (rawData as ThreeDS2ChallengePayload).challengeWindowSize
      );
    } else if (rawData && 'acs_url' in rawData && rawData.acs_url && rawData.PaReq) {
      this.openChallengeInIframe(
        rawData.acs_url,
        rawData.PaReq,
        (rawData as ThreeDS2ChallengePayload).challengeWindowSize
      );
    }

    return this.pollFor3DSCompletion()
      .then((data: PaymentIntentResponse) => {
        return data.payment_intent.active_payment_attempt;
      })
      .finally(() => this.removeIframe());
  }
}
