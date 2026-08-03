import {PaymentAttempt, PaymentAttemptStatus, PaymentMethodType} from '@/internal/payment-intent/types';
import {PAYMENT_AUTH_REDIRECT_WINDOW_NAME} from '@/hosted_fields/common/base-types';
import {PaymentRedirectTimeouts} from '@/constants/enums';
import {CbError} from '@/hosted_fields/common/errors';
import CbWindowManager from '@/models/cb-window-manager';
import StripeRealTimeApmHandler from '@/plugins/payments/_stripe_real_time_apm/handler';
import {isObjectEmpty} from '@/utils/utility-functions';
import PayByBankHandler from './index';

/**
 * Stripe Pay By Bank handler. Redirect-based real-time APM.
 * Stripe confirms the PI server-side; action_payload.redirect_url drives the redirect.
 * StripeRealTimeApmHandler calls stripe.handleNextAction({ clientSecret }) for this flow.
 */
export default class StripePayByBankHandler extends StripeRealTimeApmHandler {
  redirectTimeout: number = PaymentRedirectTimeouts.PAY_BY_BANK;

  constructor(handler: PayByBankHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment() {
    const paymentInfo: any = this.paymentInfo || {};
    const additionalData = paymentInfo.additionalData || {};
    const infoCustomer = additionalData.customer || paymentInfo.customer || {};
    const billingAddress = additionalData.billingAddress || {};
    const infoCustomerBillingAddress = infoCustomer.billingAddress || {};
    const email = additionalData.email || infoCustomer.email;
    const countryCode =
      billingAddress.countryCode || infoCustomerBillingAddress.countryCode || paymentInfo.billing_country;

    const sourceBillingAddress = !isObjectEmpty(billingAddress) ? billingAddress : infoCustomerBillingAddress;

    const customer = {
      firstName: infoCustomer.firstName,
      lastName: infoCustomer.lastName,
      email,
      billingAddress: {
        ...sourceBillingAddress,
        countryCode,
        stateCode: sourceBillingAddress.stateCode || sourceBillingAddress.state,
      },
    };
    const payload: any = {
      paymentMethodType: PaymentMethodType.PAY_BY_BANK,
    };
    if (
      customer.firstName !== undefined ||
      customer.lastName !== undefined ||
      customer.email !== undefined ||
      countryCode !== undefined ||
      !isObjectEmpty(sourceBillingAddress)
    ) {
      payload.customer = customer;
    }
    return Promise.resolve(payload);
  }

  protected handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_CHALLENGE:
      case PaymentAttemptStatus.REQUIRES_REDIRECTION: {
        return this.redirectInNewTab(paymentAttempt).then((data: any) => {
          this.setPaymentIntent(data.payment_intent);
          return this.handlePaymentAttemptStatus(this.getPaymentAttempt().status);
        });
      }
      default:
        return super.handlePaymentAttempt(paymentAttempt);
    }
  }

  private redirectInNewTab(paymentAttempt: PaymentAttempt): Promise<any> {
    const payload = paymentAttempt.action_payload || {};
    const redirectUrl: string | undefined = payload.redirect_url;

    if (!redirectUrl) {
      return Promise.reject(new CbError({name: 'GATEWAY_ERROR', message: 'Redirect URL is empty'}));
    }

    // Whole-page (redirect-mode) integrations keep navigating the top window.
    if (this.isRedirectMode && this.getPaymentIntent().success_url) {
      window.location.href = redirectUrl;
      return new Promise(() => {});
    }

    // Normal (iframe/popup) integrations: reuse the blank tab cb-instance pre-opened for
    // TabRedirectPayments; open one ourselves as a fallback.
    if (!this.windowManager) {
      this.windowManager = new CbWindowManager();
      this.windowManager.openDirect('', PAYMENT_AUTH_REDIRECT_WINDOW_NAME, {
        skipReferrer: true,
        showLoader: true,
        openInNewWindow: true,
      });
    }
    this.windowManager.loadURL(redirectUrl);
    // pollForAuthCompletion() closes the tab in its .finally() once the backend settles.
    return this.pollForAuthCompletion();
  }
}
