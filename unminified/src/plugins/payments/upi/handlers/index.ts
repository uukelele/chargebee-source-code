import {PaymentRedirectTimeouts} from '@/constants/enums';
import {UpiPayment} from '@/hosted_fields/common/base-types';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {Callbacks} from '@/extensions/three_domain_secure/common/types';
import {PaymentAttemptStatus, PaymentAttempt, PaymentMethodType, Gateway} from '@/internal/payment-intent/types';
import {PaymentInfo} from '../types';
import {
  isDocumentIdValidationRequired as checkDocumentIdValidationRequired,
  validateDocumentId as validateDocumentIdUtil,
} from '@/extensions/three_domain_secure/common/validators/document-validator';

export default class UpiHandler extends PaymentIntentHandler implements UpiPayment {
  protected declare paymentInfo: PaymentInfo;
  redirectTimeout: number = PaymentRedirectTimeouts.UPI;
  gatewayCredentials: any = null;

  constructor(...args) {
    super(...args);
  }

  initPayment() {
    const paymentData: any = {
      paymentMethodType: PaymentMethodType.UPI,
      customer: this.paymentInfo.customer,
      paymentType: this.paymentInfo.additionalData && this.paymentInfo.additionalData.paymentType,
      paymentIntent: this.getPaymentIntent(), // this is to fix GATEENGG-21778
      shippingAddress: this.getShippingAddress(),
    };

    if (this.paymentInfo.customer.first_name) {
      paymentData.customer.firstName = this.paymentInfo.customer.first_name;
    }
    if (this.paymentInfo.customer.last_name) {
      paymentData.customer.lastName = this.paymentInfo.customer.last_name;
    }

    if (this.isDocumentIdValidationRequired()) {
      paymentData.additionalInfo = {
        details: {
          document_id: this.paymentInfo.additionalData.document.number,
        },
      };
    } else {
      paymentData.planId = this.paymentInfo.additionalData && this.paymentInfo.additionalData.planId;
      paymentData.vpa = this.paymentInfo.vpa;
    }

    return Promise.resolve(paymentData);
  }

  validate(): Promise<boolean> {
    if (this.isDocumentIdValidationRequired()) {
      return Promise.resolve(this.validateDocumentId());
    }
    return Promise.resolve(true);
  }

  isDocumentIdValidationRequired(): boolean {
    return checkDocumentIdValidationRequired(this.getPaymentIntent().gateway);
  }

  validateDocumentId(): boolean {
    return validateDocumentIdUtil(this.paymentInfo);
  }

  private challengeFlow(paymentAttempt: PaymentAttempt): Promise<any> {
    // Razorpay doesn't have Redirect Flow, it will automatically send the payment request to the UPI app
    if (paymentAttempt && paymentAttempt.action_payload && paymentAttempt.action_payload.redirect_url) {
      const redirectUrl = paymentAttempt.action_payload.redirect_url;
      if (redirectUrl) {
        const iframe = this.createIframe(this.getPaymentIntent().gateway);
        this.openIframe();
        iframe.src = redirectUrl;
      }
    }
    return this.pollForAuthCompletion()
      .then((data) => {
        return data;
      })
      .finally(() => {
        this.removeIframe();
      });
  }

  handleJSPayment(paymentInfo: PaymentInfo, callbacks?: Callbacks, gatewayCredentials?: any): Promise<any> {
    return this.getGatewayHandler(this.getPaymentIntent()).then((handler) =>
      handler.handlePayment({paymentInfo, callbacks, gatewayCredentials})
    );
  }

  async handlePayment(paymentInfo: PaymentInfo, callbacks?: Callbacks): Promise<any> {
    if (this.getPaymentIntent().gateway.toLowerCase() === 'stripe') {
      return this.getGatewayHandler(this.getPaymentIntent()).then((stripeHandler) =>
        stripeHandler.initiateAuthorization(paymentInfo, callbacks)
      );
    }
    // Adyen returns the QR inline instead of redirecting, so its own handler has to run
    // rather than this base one.
    if (this.getPaymentIntent().gateway.toLowerCase() === Gateway.ADYEN) {
      return this.getGatewayHandler(this.getPaymentIntent()).then((adyenHandler) =>
        adyenHandler.initiateAuthorization(paymentInfo, callbacks)
      );
    }
    if (this.getPaymentIntent().gateway.toLowerCase() === 'razorpay') {
      if (!this.gatewayCredentials) {
        const [gatewayCredentials] = await Promise.all([this.fetchGatewayCredential()]);
        this.gatewayCredentials = gatewayCredentials;
      }
      if (this.gatewayCredentials && this.gatewayCredentials.intent_flow === true) {
        return this.handleJSPayment(paymentInfo, callbacks, this.gatewayCredentials);
      }
    }
    return this.initiateAuthorization(paymentInfo, callbacks);
  }

  handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_CHALLENGE:
      case PaymentAttemptStatus.REQUIRES_REDIRECTION:
      case PaymentAttemptStatus.PENDING_CONFIRMATION: {
        return this.challengeFlow(paymentAttempt).then((data) => {
          this.setPaymentIntent(data.payment_intent);
          return this.handlePaymentAttempt(this.getPaymentAttempt());
        });
      }
      default: {
        return this.handlePaymentAttemptStatus(paymentAttempt.status);
      }
    }
  }

  async fetchUpiInstalledAppList(): Promise<any> {
    if (!this.gatewayCredentials) {
      const [gatewayCredentials] = await Promise.all([this.fetchGatewayCredential()]);
      this.gatewayCredentials = gatewayCredentials;
    }
    return this.getGatewayHandler(this.getPaymentIntent()).then((handler) =>
      handler.fetchUpiInstalledAppList(this.gatewayCredentials)
    );
  }
}
