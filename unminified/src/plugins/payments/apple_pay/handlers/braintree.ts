import ApplepayHandler from '@/plugins/payments/apple_pay/handlers';
import BraintreeUtils from '@/utils/payments/braintree';
import {
  PaymentCompleteStatus,
  BraintreeApplePayInstance,
  BraintreeClientInstance,
  BraintreeDeviceDataCollectorInstance,
  BraintreeApplePayOptions,
  ApplePaymentEvent,
  BraintreeApplePaySession,
  AddressContact,
  BraintreePaymentRequest,
} from '@/plugins/payments/apple_pay/types';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {Callbacks, PaymentMethodType} from '@/internal/payment-intent/types';
import {
  transformAddress,
  mountApplePayButton,
  addFieldsToPaymentRequest,
  attachEventListener,
  loadApplePaySdk,
} from '../utils';
import Logger from '@/utils/logger_old';
import Helpers from '@/helpers';
import Ids from '@/constants/ids';

export default class BraintreeApplePayHandler extends ApplepayHandler {
  applePayInstance: BraintreeApplePayInstance;
  clientInstance: BraintreeClientInstance;
  deviceDataCollectorInstance: BraintreeDeviceDataCollectorInstance;
  mountOptions: BraintreeApplePayOptions;
  paymentEvent: ApplePaymentEvent;
  session: BraintreeApplePaySession;

  constructor(handler: ApplepayHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
  }

  getPaymentData(): any {
    const paymentEvent = this.paymentEvent.payment;
    const payload: any = {
      shipping_address: transformAddress(paymentEvent.shippingContact),
      billing_address: transformAddress(this.paymentEvent.payment.billingContact),
    };
    if (paymentEvent && paymentEvent.shippingContact) {
      payload.customer = {
        firstName: paymentEvent.shippingContact.givenName,
        lastName: paymentEvent.shippingContact.familyName,
        email: paymentEvent.shippingContact.emailAddress,
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

  initCallbacks(paymentInfo, callbacks: Callbacks) {
    const _callbacks: Callbacks = {
      ...callbacks,
      success: (paymentIntent) => {
        this.session.completePayment(PaymentCompleteStatus.SUCCESS);
        callbacks && callbacks.success && callbacks.success(paymentIntent);
      },
      error: (err) => {
        this.session.completePayment(PaymentCompleteStatus.FAIL);
        callbacks && callbacks.error && callbacks.error(err);
      },
    };
    super.initCallbacks(paymentInfo, _callbacks);
  }

  createApplePayInstance(): Promise<BraintreeApplePayInstance> {
    return BraintreeUtils.loadApplePay()
      .then(() =>
        BraintreeUtils.braintree().applePay.create({
          client: this.clientInstance,
        })
      )
      .then((applePayInstance: any) => {
        this.applePayInstance = applePayInstance;
        return applePayInstance;
      });
  }

  mountPaymentButton(selector: string, options: BraintreeApplePayOptions): Promise<any> {
    this.mountOptions = options;
    return (
      BraintreeUtils.initializeBraintreeClient(this.getPaymentIntent())
        .then((clientInstance) => {
          this.clientInstance = clientInstance;
          // Load Device data collector
          return BraintreeUtils.initializeDataCollector(this.clientInstance);
        })
        .then((deviceDataCollectorInstance) => {
          this.deviceDataCollectorInstance = deviceDataCollectorInstance;
        })
        // Create braintree apple pay instance
        .then(() => this.createApplePayInstance())
        .then(() => {
          if (!window.ApplePaySession) {
            return loadApplePaySdk();
          }
        })
        // mount button
        .then(() => {
          const containerEl: HTMLElement = document.querySelector(selector);
          if (!containerEl) return Promise.reject(new CbError(Errors.containerElementNotFound));
          return mountApplePayButton(containerEl, options, () => this.startSession());
        })
    );
  }

  createPaymentRequest(): Promise<BraintreePaymentRequest> {
    const options = this.mountOptions;
    const paymentRequestData: any = addFieldsToPaymentRequest(options, {
      total: {
        label: (options && options.totalLabel) || 'Total',
        amount: this.getPaymentIntent().amount / 100,
      },
    });
    return Promise.resolve(this.applePayInstance.createPaymentRequest(paymentRequestData));
  }

  createApplePaySession(paymentRequest: BraintreePaymentRequest): Promise<BraintreeApplePaySession> {
    // @ts-ignore
    // TODO: Fix typescript interface - constructable
    const session = new window.ApplePaySession(14, paymentRequest);

    attachEventListener(session, this);
    session.onvalidatemerchant = (event) => {
      const params = new URLSearchParams(window.location.search);
      const referer = params.get('referer');
      let validationPayload = {
        validationURL: event.validationURL,
        displayName: this.mountOptions.storeName || 'Chargebee',
      };
      //refererDomain is used for payment-component
      const cbInstance = Helpers.getCbInstance();
      const referrerModule = cbInstance && cbInstance.options && cbInstance.options.referrerModule;
      if (referer && (referrerModule === Ids.CB_PAYMENT_COMPONENTS || referrerModule === Ids.PC_FPC_V4 || referrerModule === Ids.PC_INAPP_V4)) {
        try {
          const refererDomain = new URL(referer).hostname;
          if (refererDomain) {
            // @ts-ignore
            validationPayload.domainName = refererDomain;
            this.kvl({
              action: 'apple_pay_referer',
              referer_domain: refererDomain,
              gateway: 'braintree',
            });
          }
        } catch (e) {
          Logger.error(e);
        }
      }
      this.applePayInstance
        .performValidation(validationPayload)
        .then((merchantSession) => {
          session.completeMerchantValidation(merchantSession);
        })
        .catch((validationErr) => {
          this.callbackHandler.triggerErrorCallback(new CbError(validationErr));
          session.abort();
        });
    };

    session.oncancel = (event) => {
      this.callbackHandler.triggerCancelCallback();
    };

    session.onpaymentauthorized = (event: ApplePaymentEvent) => {
      this.paymentEvent = event;
      this.applePayInstance
        .tokenize({
          token: event.payment.token,
        })
        .then((payload) =>
          this.confirmPayment({
            paymentMethodType: PaymentMethodType.APPLEPAY,
            tmpToken: payload.nonce,
            deviceData: this.deviceDataCollectorInstance.deviceData,
          })
        )
        .catch((tokenizeErr) => {
          this.callbackHandler.triggerErrorCallback(new CbError(tokenizeErr));
        });
    };

    return Promise.resolve(session);
  }

  async startSession(): Promise<any> {
    try {
      await this.callbackHandler.triggerClickCallback();
    } catch (err) {
      return Promise.reject(err);
    }

    if (!window.ApplePaySession) {
      return this.createPaymentRequest().then((paymentRequest) => this.startCrossBrowserFlow(paymentRequest));
    }

    return this.createPaymentRequest()
      .then((paymentRequest) => this.createApplePaySession(paymentRequest))
      .then((session) => {
        this.session = session;
        try {
          return session.begin();
        } catch (err) {
          // just to avoid : (InvalidAccessError: Page already has an active payment session) in console
          if (err.message != 'Page already has an active payment session.') {
            throw err;
          }
        }
      });
  }
}
