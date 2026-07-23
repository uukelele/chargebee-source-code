import AbstractThreeDSecureHandler from '@/extensions/three_domain_secure/handlers/abstract';
import ThreeDSecureHandler from '@/extensions/three_domain_secure/index';
import {
  PaymentAttempt,
  PaymentAttemptStatus,
  PaymentIntentResponse,
  PaymentMethodType,
  Address,
  ConfirmApiInputPayload,
  PaymentFlow,
} from '@/plugins/three_domain_secure/types';
import {Gateway} from '@/extensions/three_domain_secure/common/types';
import {validateRawCardDetails} from '@/extensions/three_domain_secure/common/utils';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import Utils from '@/utils/payments/utils';
import {Base3DSConfig} from './types';
import {
  isDocumentIdValidationRequired as checkDocumentIdValidationRequired,
  validateDocumentId as validateDocumentIdUtil,
} from '@/extensions/three_domain_secure/common/validators/document-validator';

export default abstract class Base3DSHandler extends AbstractThreeDSecureHandler {
  config: Base3DSConfig;

  constructor(parent: ThreeDSecureHandler, config: Base3DSConfig) {
    super(parent);
    this.config = config;
  }

  validate(): boolean {
    const hasRawCard = !!this.paymentInfo.card;
    const hasReferenceId = !!this.getReferenceId();
    const hasCbToken = !!this.paymentInfo.cbToken;
    const hasCardComponent = !!this.paymentInfo.cardComponent;
    const hasPaymentComponent = !!this.paymentInfo.paymentComponent;

    // Check if at least one supported flow is present
    const supportedFlows = [
      {condition: hasRawCard, flow: 'card'},
      {condition: hasReferenceId, flow: 'reference_id'},
      {condition: hasCbToken, flow: 'cbToken'},
      {condition: hasCardComponent, flow: 'cardComponent'},
      {condition: hasPaymentComponent, flow: 'paymentComponent'},
    ];
    const isAnyFlowSupported = supportedFlows.some(
      (flow) => flow.condition && this.config.supported_flows.includes(flow.flow)
    );

    if (!isAnyFlowSupported) {
      throw new CbError(Errors.missingPayPaymentInfo);
    }

    if (hasRawCard) {
      validateRawCardDetails(this.paymentInfo.card);
      if (this.isDocumentIdValidationRequired()) {
        this.validateDocumentId();
      }
      if (this.config.cardHolderInfoRequired && !this.paymentInfo.card.firstName && !this.paymentInfo.card.lastName) {
        throw new CbError(Errors.missingCardHolderInfo);
      }
    }

    return true;
  }

  isDocumentIdValidationRequired(): boolean {
    return checkDocumentIdValidationRequired(this.config.gateway as Gateway);
  }

  validateDocumentId(): boolean {
    return validateDocumentIdUtil(this.paymentInfo);
  }

  abstract handlePayment(): void;

  protected getConfirmPayload(paymentData): ConfirmApiInputPayload {
    let custBillingAddress: Address = this.getCustomerBillingAddress() || {};
    let pmBillingAddress: Address = this.getCardBillingAddress() || {};
    let additionalMetaData: {} = this.getAdditionalMetaData();
    let documentNumber;
    if (this.paymentInfo.additionalData && this.paymentInfo.additionalData.document) {
      documentNumber = this.paymentInfo.additionalData.document.number;
    }
    const additionalInfo: any = {
      metaData: additionalMetaData,
    };
    if (this.isDocumentIdValidationRequired()) {
      additionalInfo.details = {
        document_id: documentNumber,
      };
    }

    let payload = {
      paymentMethodType: PaymentMethodType.CARD,
      browserDetails: Utils.getBrowserDetails(),
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
      additionalInfo,
    };

    if (this.callbacks.challenge) {
      payload['paymentFlow'] = PaymentFlow.REDIRECT;
    }
    return payload;
  }

  protected closeWindowIfOpen() {
    this.parent && this.parent.closeTab();
  }

  protected handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_CHALLENGE:
        this.callChange();
        return this.do3DSChallenge(paymentAttempt).then((data: any) => {
          if (data.payment_intent) {
            this.setPaymentIntent(data.payment_intent);
            return this.handlePaymentAttempt(this.getPaymentAttempt());
          }
        });
      case PaymentAttemptStatus.AUTHORIZED:
        this.closeChallengeWindow();
        this.callSuccess();
        return Promise.resolve(true);
      case PaymentAttemptStatus.PENDING_AUTHORIZATION:
        return this.pollFor3DSCompletionForPendingAuthorization().then((data) => {
          this.setPaymentIntent(data.payment_intent);
          return this.handlePaymentAttempt(this.getPaymentAttempt());
        });
      case PaymentAttemptStatus.REFUSED:
      default:
        this.closeChallengeWindow();
        throw this.intentError();
    }
  }

  protected do3DSChallenge(paymentAttempt: PaymentAttempt): Promise<any> {
    const redirectUrl = paymentAttempt.action_payload.redirect_url;
    if (this.callbacks.challenge) {
      this.callbacks.challenge(redirectUrl);
    }
    // Do page redirect as success_url is present at intent
    if (this.parent.hasReturnUrlAtIntent()) {
      window.location.href = redirectUrl;
      return new Promise(() => {});
    }

    if (this.config.challenge_window === 'iframe') {
      this.openHiddenIframe(redirectUrl);
    } else if (this.config.challenge_window === 'tab') {
      // this.parent.openNewWindow();
      this.parent.windowManager.loadURL(redirectUrl);
    }
    return this.pollFor3DSCompletion()
      .then((data: PaymentIntentResponse) => {
        return data;
      })
      .finally(() => this.closeChallengeWindow());
  }

  private openHiddenIframe(redirectUrl) {
    const iframe = this.createIframe();
    this.openIframe();
    iframe.src = redirectUrl;
  }

  protected closeChallengeWindow() {
    if (this.config.challenge_window === 'iframe') {
      this.removeIframe();
    } else if (this.config.challenge_window === 'tab') {
      this.parent && this.parent.closeTab();
    }
  }
}
