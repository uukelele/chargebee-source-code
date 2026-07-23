import {
  mountApplePayButton,
  addFieldsToPaymentRequest,
  transformAddress,
  attachEventListener,
  loadApplePaySdk,
} from '../utils';
import ApplepayHandler from '@/plugins/payments/apple_pay/handlers';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {
  CommmonApplePayOptions,
  CommonGatewayCredential,
  PaymentRequest,
  CommonApplePaySession,
  ApplePaymentEvent,
} from '@/plugins/payments/apple_pay/types';
import {Callbacks, PaymentMethodType} from '@/internal/payment-intent/types';
import Logger from '@/utils/logger_old';
import Helpers from '@/helpers';
import Ids from '@/constants/ids';

export default class DirectApplePayHandler extends ApplepayHandler {
  mountOptions: CommmonApplePayOptions;
  private gatewayCredential: CommonGatewayCredential = {
    apple_pay: {
      merchant_country_code: '',
      copy_billing_address: false,
      copy_shipping_address: false,
      copy_contact: false,
    },
  };
  private session: CommonApplePaySession;
  paymentEvent: ApplePaymentEvent;

  constructor(handler: ApplepayHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
  }

  private preloadConfig() {
    return this.fetchGatewayCredential().then((data) => {
      this.gatewayCredential = data;
      return data;
    });
  }

  mountPaymentButton(selector: string, options: CommmonApplePayOptions): Promise<any> {
    this.mountOptions = options;
    return this.preloadConfig()
      .then(() => {
        if (!window.ApplePaySession) {
          return loadApplePaySdk();
        }
      })
      .then(() => {
        const el: HTMLElement = document.querySelector(selector);
        // @ts-ignore
        if (el) el.style.display = 'block';
        return mountApplePayButton(el, options, () => this.startSession());
      });
  }

  initCallbacks(paymentInfo, callbacks: Callbacks) {
    const _callbacks: Callbacks = {
      ...callbacks,
      success: (paymentIntent) => {
        this.session.completePayment(window.ApplePaySession.STATUS_SUCCESS);
        callbacks && callbacks.success && callbacks.success(paymentIntent);
      },
      error: (err) => {
        this.session.completePayment(window.ApplePaySession.STATUS_FAILURE);
        callbacks && callbacks.error && callbacks.error(err);
      },
    };
    super.initCallbacks(paymentInfo, _callbacks);
  }

  async startSession() {
    try {
      await this.callbackHandler.triggerClickCallback();
    } catch (err) {
      return Promise.reject(err);
    }
    if (!window.ApplePaySession) {
      const paymentRequest = this.createPaymentRequest();
      return this.startCrossBrowserFlow(paymentRequest);
    }
    const paymentRequest = this.createPaymentRequest();
    this.createApplePaySession(paymentRequest);
  }

  createPaymentRequest(): PaymentRequest {
    const {requestPayerEmail, requestPayerName, requestPayerPhone, requestShipping, requestBilling} = this.mountOptions;
    const {apple_pay: {merchant_country_code = 'US', copy_billing_address, copy_shipping_address, copy_contact} = {}} =
      this.gatewayCredential;

    const options = {
      ...this.mountOptions,
      requestPayerEmail: requestPayerEmail || copy_contact,
      requestPayerName: requestPayerName || copy_contact,
      requestPayerPhone: requestPayerPhone || copy_contact,
      requestShipping: requestShipping || copy_shipping_address,
      requestBilling: requestBilling || copy_billing_address,
    };

    const paymentRequestData: any = addFieldsToPaymentRequest(options, {
      currencyCode: this.getPaymentIntent().currency_code,
      countryCode: merchant_country_code,
      total: {
        label: (options && options.totalLabel) || 'Total',
        amount: this.getPaymentIntent().amount / 100,
      },
      supportedNetworks: this.getSupportedNetworks(),
      merchantCapabilities: this.getMerchantCapabilities(),
    });
    return paymentRequestData;
  }

  protected getApplePaySessionVersion(): number {
    return 14;
  }

  createApplePaySession(paymentRequest: PaymentRequest): Promise<CommonApplePaySession> {
    // @ts-ignore
    this.session = new window.ApplePaySession(this.getApplePaySessionVersion(), paymentRequest);
    this.session.begin();
    attachEventListener(this.session, this);
    this.session.onvalidatemerchant = (event) => {
      const params = new URLSearchParams(window.location.search);
      const referer = params.get('referer');
      let validationPayload = {
        payload: {
          validationURL: event.validationURL,
          domain: location.hostname,
        },
        paymentIntentId: this.getPaymentIntent().id,
      };
      //refererDomain is used for payment-component
      const cbInstance = Helpers.getCbInstance();
      const referrerModule = cbInstance && cbInstance.options && cbInstance.options.referrerModule;
      if (referer && (referrerModule === Ids.CB_PAYMENT_COMPONENTS || referrerModule === Ids.PC_FPC_V4 || referrerModule === Ids.PC_INAPP_V4)) {
        try {
          const refererDomain = new URL(referer).hostname;
          if (refererDomain) {
            this.kvl({
              action: 'apple_pay_referer',
              referer_domain: refererDomain,
              gateway: this.getPaymentIntent().gateway,
            });
            // @ts-ignore
            validationPayload.payload.domain = refererDomain;
          }
        } catch (e) {
          Logger.error(e);
        }
      }
      this.validateApplePaySession(validationPayload)
        .then((merchantSession) => {
          this.session.completeMerchantValidation(merchantSession);
        })
        .catch((validationErr) => {
          this.callbackHandler.triggerErrorCallback(new CbError(validationErr));
          this.session.abort();
        });
    };

    this.session.oncancel = (event) => {
      this.callbackHandler.triggerCancelCallback();
    };

    this.session.onpaymentauthorized = (event: ApplePaymentEvent) => {
      this.paymentEvent = event;
      const paymentData = this.getPaymentData();
      this.confirmPayment({
        paymentMethodType: PaymentMethodType.APPLEPAY,
        shippingAddress: paymentData.shipping_address,
        cardBillingAddress: paymentData.billing_address,
        customer: paymentData.customer,
        applePay: this.getApplePayToken(event),
      });
    };

    return Promise.resolve(this.session);
  }

  protected getSupportedNetworks(): string[] {
    return ['visa', 'masterCard', 'amex', 'discover'];
  }

  protected getMerchantCapabilities(): string[] {
    return ['supports3DS'];
  }

  protected getApplePayToken(event: ApplePaymentEvent): any {
    return event.payment.token.paymentData;
  }

  getPaymentData(): any {
    const paymentEvent = this.paymentEvent.payment;
    const payload: any = {
      shipping_address: transformAddress(paymentEvent.shippingContact),
      billing_address: transformAddress(paymentEvent.billingContact),
    };
    if (paymentEvent && paymentEvent.shippingContact) {
      payload.customer = {
        firstName: paymentEvent.shippingContact.givenName,
        lastName: paymentEvent.shippingContact.familyName,
        email: paymentEvent.shippingContact.emailAddress,
        phone: paymentEvent.shippingContact.phoneNumber,
      };
    }
    if (
      paymentEvent &&
      paymentEvent.token &&
      paymentEvent.token.paymentMethod &&
      paymentEvent.token.paymentMethod.displayName
    ) {
      payload.card = {
        last4: paymentEvent.token.paymentMethod.displayName,
      };
    }
    return payload;
  }
}
