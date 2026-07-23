import {PAYMENT_AUTH_REDIRECT_WINDOW_NAME} from '@/hosted_fields/common/base-types';
import {PaymentAttemptStatus, PaymentAttempt} from '@/internal/payment-intent/types';
import BancontactHandler from '@/plugins/payments/bancontact/handlers';
import {PaymentMethodType} from '@/internal/payment-intent/types';
import Errors, {CbError} from '@/hosted_fields/common/errors';

export default class AdyenBancontactHandler extends BancontactHandler {
  constructor(handler: BancontactHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
  }

  validate() {
    if (!this.hasElement() && !this.hasRawCard()) {
      throw new CbError(Errors.missingBancontactAdyenPaymentInfo);
    }
    return Promise.resolve(true);
  }

  initPayment() {
    let payload: any = {
      paymentMethodType: PaymentMethodType.BANCONTACT,
    };
    if (this.hasElement()) {
      try {
        payload.paymentMethod = this.paymentInfo.element.data.paymentMethod;
      } catch (err) {
        throw new CbError(Errors.invalidAdyenCheckoutInstance, err);
      }
    } else if (this.hasRawCard()) {
      payload.paymentMethod = this.paymentInfo.card;
    }
    if (this.paymentInfo.cardBillingAddress) {
      payload.cardBillingAddress = this.paymentInfo.cardBillingAddress;
    }
    if (this.paymentInfo.customer && this.paymentInfo.customer.email) {
      payload.email = this.paymentInfo.customer.email;
    }
    return Promise.resolve(payload);
  }

  private hasElement(): boolean {
    return !!this.paymentInfo.element;
  }

  private hasRawCard(): boolean {
    return !!this.paymentInfo.card;
  }

  private createHiddenForm(paymentAttempt: PaymentAttempt) {
    const rawData = paymentAttempt.action_payload;
    let redirectObj;
    if (rawData.action != null && rawData.action !== undefined) {
      redirectObj = rawData.action;
    } else {
      redirectObj = rawData.redirect;
    }

    const hiddenForm = document.createElement('form');
    hiddenForm.method = redirectObj.method;
    hiddenForm.action = redirectObj.url;

    // Attach meta info as query params to redirect url
    const baseUrl = redirectObj.data['TermUrl'];
    // @ts-ignore
    const jsDomain = __JS_DOMAIN__;
    const src = encodeURIComponent(jsDomain);
    redirectObj.data['TermUrl'] = baseUrl;

    // Create hidden input fields to pass params on form submit
    Object.keys(redirectObj.data).map((urlParam) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = urlParam;
      input.value = redirectObj.data[urlParam];
      hiddenForm.appendChild(input);
    });

    return hiddenForm;
  }

  private doVerification(paymentAttempt: PaymentAttempt): Promise<any> {
    const rawData = paymentAttempt.action_payload;
    const isRedirectMode = this.isRedirectMode && this.getPaymentIntent().success_url;

    const hiddenForm = this.createHiddenForm(paymentAttempt);

    if (this.isIframeMode) {
      const iframe = this.createIframe('adyen');
      this.openIframe();
      // Set form target as Iframe (To open 3DS Verification form inside the iframe)
      hiddenForm.target = iframe.name;
      setTimeout(() => this.hideIframeLoader(), 2000);
    } else if (!isRedirectMode) {
      // Set form target as redirect window (To open 3DS Verification form inside the window)
      hiddenForm.target = PAYMENT_AUTH_REDIRECT_WINDOW_NAME;
    }

    document.body.appendChild(hiddenForm);

    // Auto submit form
    hiddenForm.submit();

    if (isRedirectMode) {
      return new Promise(() => {});
    }
    this.windowManager.watchClose(() => this.callbackHandler.triggerCancelCallback());

    return this.pollForAuthCompletion();
  }

  handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_REDIRECTION: {
        return this.doVerification(paymentAttempt).then((data) => {
          this.setPaymentIntent(data.payment_intent);
          return this.handlePaymentAttempt(this.getPaymentAttempt());
        });
      }
    }
  }
}
