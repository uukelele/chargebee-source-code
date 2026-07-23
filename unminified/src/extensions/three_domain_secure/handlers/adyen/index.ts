import AbstractThreeDSecureHandler from '@/extensions/three_domain_secure/handlers/abstract';
import {
  PaymentAttemptStatus,
  PaymentAttempt,
  ConfirmApiInputPayload,
  PaymentFlow,
  PaymentIntentResponse,
} from '@/extensions/three_domain_secure/common/types';
import {Adyen} from '@/extensions/three_domain_secure/handlers/adyen/types';
import ThreeDSecureHandler from '@/extensions/three_domain_secure/index';
import {validateRawCardDetails, loadScriptUsingPredicate} from '@/extensions/three_domain_secure/common/utils';
import {Master as M} from '@/hosted_fields/common/enums';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import LightBox from '@/extensions/three_domain_secure/common/lightbox';
import Helpers from '@/helpers';
import {gwJsonify} from '@/utils/utility-functions';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import Ids from '@/constants/ids';
import {constructPaymentIntentApiPayload} from '@/internal/common/utils';
import {ThreeDSPollingTimeouts} from '@/constants/enums';

import {loadAdyenJsAndCss, DEFAULT_ADYEN_VERSION} from '@/utils/payments/adyen';
import Utils from '@/utils/payments/utils';

const helper = {
  hasDFLoaded() {
    // @ts-ignore
    return !!window.dfDo;
  },
};

type AdyenConfirmActionResponse = {
  method?: 'GET' | 'POST';
  type?: 'redirect';
  url?: string;
};

export default class Adyen3DSHandler extends AbstractThreeDSecureHandler {
  private adyenClient: any;
  private adyenActionResolver: any;

  constructor(parent: ThreeDSecureHandler) {
    super(parent);
    this.adyenClient = this.parent.options.adyen;
  }

  validate() {
    const hasElements = !!this.paymentInfo.element;
    const hasClientSideEncryption = !!(
      this.paymentInfo.additionalData && this.paymentInfo.additionalData.encryptedCardDetails
    );
    const hasRawCardDetails = !!this.paymentInfo.card;
    const hasReferenceId = !!this.getReferenceId();
    const hasCardComponent = !!this.paymentInfo.cardComponent;
    const hadPaymentComponent = !!this.paymentInfo.paymentComponent;

    if (
      !hasElements &&
      !hasClientSideEncryption &&
      !hasRawCardDetails &&
      !hasReferenceId &&
      !hasCardComponent &&
      !hadPaymentComponent
    ) {
      throw new CbError(Errors.missingAdyenPaymentInfo);
    }

    if (hasRawCardDetails) {
      validateRawCardDetails(this.paymentInfo.card);
    }

    return true;
  }

  checkAdyenInstance() {
    const hasRawCardDetails = !!this.paymentInfo.card;
    const hasReferenceId = !!this.getReferenceId();
    const hasCardComponent = !!this.paymentInfo.cardComponent;
    const hadPaymentComponent = !!this.paymentInfo.paymentComponent;

    if (!this.adyenClient && (hasRawCardDetails || hasReferenceId || hasCardComponent || hadPaymentComponent)) {
      return Promise.all([loadAdyenJsAndCss(DEFAULT_ADYEN_VERSION), this.fetchGatewayCredential()]).then(([_, res]) =>
        this.createAdyenCheckoutInstance(res.client_key)
      );
    } else if (this.adyenClient) {
      const onAdditionalDetails = this.adyenClient.options.onAdditionalDetails;
      const that = this;
      this.adyenClient.update({
        onAdditionalDetails: (state, component) => {
          that.onAdditionalDetails(state, component);
          onAdditionalDetails && onAdditionalDetails(state, component);
        },
      });
      return Promise.resolve();
    } else return Promise.resolve();
  }

  onAdditionalDetails(state, component) {
    if (this.adyenActionResolver) {
      const payload = {
        additionalInfo: state.data,
      };
      this.adyenActionResolver(payload);
      this.removePlaceholderElement();
      this.adyenActionResolver = null;
    }
  }

  generateOriginKey(): Promise<string> {
    const data: any = constructPaymentIntentApiPayload(this.getPaymentIntent());
    data.origin = window.location.origin;

    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.GenerateAdyenOriginKey,
          data,
        },
        Ids.MASTER_FRAME,
        {timeout: 10000}
      )
    ).then((data: any) => {
      const keys = data.keys;
      const originKey: string = keys[window.location.origin];
      return originKey;
    });
  }

  async createAdyenCheckoutInstance(originKey: any) {
    if (!originKey || typeof originKey !== 'string') {
      Promise.reject(new CbError(Errors.invalidAdyenOriginKey));
    }
    const that = this;
    const environment = Helpers.isTestSite() ? 'test' : 'live';
    // @ts-ignore
    this.adyenClient = await new window.AdyenCheckout({
      environment,
      originKey,
      clientKey: originKey,
      onAdditionalDetails: function (state, component) {
        that.onAdditionalDetails(state, component);
      },
      onChange: (data) => {
        //
      },
      onError: (err) => {
        throw new CbError(this.sanitizeAdyenError(err));
      },
    });
    return Promise.resolve(this.adyenClient);
  }

  handlePayment() {
    const hasRawCardDetails = !!this.paymentInfo.card;
    const hasReferenceId = !!this.getReferenceId();
    const hasCardComponent = !!this.paymentInfo.cardComponent;
    const hadPaymentComponent = !!this.paymentInfo.paymentComponent;

    const payload: ConfirmApiInputPayload = {
      ...Utils.getBrowserFingerprint(),
    };

    if (this.paymentInfo.element) {
      try {
        payload.paymentMethod = this.paymentInfo.element.data.paymentMethod;
        const billingAddress = this.paymentInfo.additionalData && this.paymentInfo.additionalData.billingAddress;
        if (billingAddress && billingAddress.firstName && billingAddress.lastName) {
          payload.paymentMethod = {
            ...payload.paymentMethod,
            firstName: billingAddress.firstName,
            lastName: billingAddress.lastName,
          };
        }
      } catch (err) {
        this.callError(new CbError(Errors.invalidAdyenCheckoutInstance, err));
      }
    }

    if (this.hasAdditionalData()) {
      const additionalData = this.paymentInfo.additionalData;

      let additionalMetaData: {} = this.getAdditionalMetaData();
      if (additionalMetaData) {
        payload.additionalInfo = {
          ...payload.additionalInfo,
          metaData: additionalMetaData,
        };
      }

      if (additionalData.encryptedCardDetails) {
        payload.additionalInfo = {
          ...payload.additionalInfo,
          encryptedCardDetails: additionalData.encryptedCardDetails,
        };
      }

      payload.cardBillingAddress = this.getCardBillingAddress();
      payload.billingAddress = this.getCardBillingAddress();

      if (additionalData.email) {
        payload.email = additionalData.email;
      }
      if (additionalData.phone) {
        payload.customer = {
          phone: additionalData.phone,
        };
      }
    }

    if (this.paymentInfo.card) {
      payload.paymentMethod = this.paymentInfo.card;
    }

    if (hasCardComponent) {
      payload.cardComponent = this.paymentInfo.cardComponent;
    }

    if (hadPaymentComponent) {
      payload.paymentComponent = this.paymentInfo.paymentComponent;
    }

    if (this.callbacks.challenge) {
      payload.paymentFlow = PaymentFlow.REDIRECT;
    }

    /**
     * Since card and bancontact payments are similar in nature,
     * 3DS handler is reused for bancontact payments when Adyen components are used
     * to avoid code redundancy.
     * Hence payment method type is read from payment intent and set in confirm API payload
     * since card payment will be considered as default when payment method type is not set.
     */
    const paymentIntent = this.getPaymentIntent();
    if (paymentIntent && paymentIntent.payment_method_type) {
      payload.paymentMethodType = paymentIntent.payment_method_type;
    }

    const urlPrefix = Helpers.isTestSite() ? 'test' : 'live';
    (hasRawCardDetails || hasReferenceId || hasCardComponent
      ? loadScriptUsingPredicate(
          `https://${urlPrefix}.adyen.com/hpp/js/df.js?v=${new Date().getTime()}`,
          helper.hasDFLoaded
        ).then(() => this.doManualDeviceFingerprinting(payload))
      : Promise.resolve(payload)
    ).then((_payload) => this.handlePaymentFlow(payload));
  }

  doManualDeviceFingerprinting(payload: any) {
    return new Promise((resolve, reject) => {
      if (helper.hasDFLoaded()) {
        // Create hidden input
        const input = document.createElement('input');
        const id = `adyen_fingerprint_${new Date().getTime()}`;
        input.setAttribute('type', 'hidden');
        input.id = id;
        document.body.appendChild(input);

        try {
          // @ts-ignore
          window.dfDo(id);
          // @ts-ignore
          window.dfSet(id, 0);
        } catch (e) {
          this.kvl({
            ...gwJsonify(e),
            action: 'gateway_client_error',
            gw: 'adyen',
            description: 'Manual device fingerprinting failed',
          });
          return resolve(payload);
        }

        const deviceFingerprint = input.value;
        if (deviceFingerprint) payload.deviceFingerprint = deviceFingerprint;
        resolve(payload);
      } else {
        resolve(payload);
      }
    });
  }

  handlePaymentFlow(payload) {
    return this.checkAdyenInstance()
      .then(() => this.confirmPayment(payload))
      .catch((error) => {
        // Check for Adyen error
        error = this.sanitizeAdyenError(error);
        this.callError(error);
      });
  }

  sanitizeAdyenError(error: Adyen.Error = {}) {
    this.kvl({
      ...gwJsonify(error),
      action: 'gateway_client_error',
      gw: 'adyen',
    });
    if (error.errorCode) {
      return new CbError(
        {
          name: (error.errorCode + '').toUpperCase(),
          message: error.message,
          code: error.status,
          type: error.errorType,
        },
        error
      );
    } else {
      return new CbError(error, error);
    }
  }

  createPlaceholderElement() {
    this.lightbox = new LightBox('adyen');
    const containerEl = document.createElement('div');
    containerEl.className = 'frame-contents no-spinner';
    containerEl.id = 'cb-adyen-3ds-webcomponent';
    this.lightbox.getWrapperEl().appendChild(containerEl);
    this.openIframe();
    return containerEl;
  }

  removePlaceholderElement() {
    this.removeIframe();
  }

  handleAdyenAction(paymentAttempt: PaymentAttempt) {
    const rawResponse = paymentAttempt.action_payload;
    const containerEl = this.createPlaceholderElement();

    return new Promise((resolve, reject) => {
      this.adyenActionResolver = resolve;
      const challengeWindowSize = this.hasAdditionalData() && this.paymentInfo.additionalData.challengeWindowSize;
      this.setChallengeWindowSize(containerEl, challengeWindowSize);
      const threeDSConfiguration = challengeWindowSize
        ? {
            challengeWindowSize: challengeWindowSize,
          }
        : {};
      this.adyenClient.createFromAction(rawResponse.action, threeDSConfiguration).mount(`#${containerEl.id}`);
    });
  }

  private createHiddenForm(paymentAttempt: PaymentAttempt) {
    const rawData = paymentAttempt.action_payload;

    if (!rawData || (!rawData.action && !rawData.redirect)) {
      throw new CbError(Errors.missingAdyenRedirectInfo);
    }

    const hiddenForm = document.createElement('form');
    let redirectObj;
    if (rawData.action) {
      redirectObj = rawData.action;
    } else {
      redirectObj = rawData.redirect;
    }
    hiddenForm.method = redirectObj.method;
    hiddenForm.action = redirectObj.url;

    // Attach meta info as query params to redirect url
    const baseUrl = redirectObj.data['TermUrl'];
    // @ts-ignore
    const jsDomain = __JS_DOMAIN__;
    const src = encodeURIComponent(jsDomain);

    /**
     * Bancontact API handler takes care of adding paymentIntentId as a query param
     * to the redirect URL. Hence adding check to prevent malformed redirect URL
     */
    const paymentIntent = this.getPaymentIntent();
    if (paymentIntent.payment_method_type === 'bancontact') {
      redirectObj.data['TermUrl'] = baseUrl;
    } else {
      redirectObj.data['TermUrl'] = `${baseUrl}?paymentIntentId=${this.getPaymentIntent().id}&src=${src}`;
    }

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

  private do3DS1Verification(paymentAttempt: PaymentAttempt): Promise<any> {
    const rawData = paymentAttempt.action_payload;

    const hiddenForm = this.createHiddenForm(paymentAttempt);
    const iframe = this.createIframe();
    this.openIframe();

    // Set form target as Iframe (To open 3DS Verification form inside the iframe)
    hiddenForm.target = iframe.name;

    document.body.appendChild(hiddenForm);
    // Auto submit form
    hiddenForm.submit();

    return this.pollFor3DS1Completion().then((data) => {
      // Remove iframe
      this.removeIframe();

      return {
        additionalInfo: {
          details: data,
          paymentData: rawData.paymentData,
        },
      };
    });
  }

  private pollFor3DS1Completion() {
    const paymentIntent = this.getPaymentIntent();
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.PollAdyen3DS1,
          data: {paymentIntentId: paymentIntent.id},
        },
        Ids.MASTER_FRAME,
        {timeout: ThreeDSPollingTimeouts.DEFAULT}
      )
    );
  }

  private handleRedirect(paymentAttempt: PaymentAttempt): Promise<any> {
    // Handle redirect flow
    const {action}: {action: AdyenConfirmActionResponse} = paymentAttempt.action_payload || {};
    if (this.getPaymentIntent().success_url) {
      window.top.location.href = action.url;
      return Promise.resolve({});
    } else if (action.method === 'GET' && action.type === 'redirect') {
      if (this.callbacks.challenge) {
        this.callbacks.challenge(action.url);
        return this.pollFor3DSCompletion().then((data: PaymentIntentResponse) => {
          this.setPaymentIntent(data.payment_intent);
          return this.handlePaymentAttempt(this.getPaymentAttempt());
        });
      } else {
        window.top.location.href = action.url;
      }
    }

    // Fallback to 3DS1 Redirection
    return this.do3DS1Verification(paymentAttempt).then((data) => {
      if (this.getPaymentIntent().payment_method_type === 'bancontact') {
        const updatedIntent = data.additionalInfo.details.payment_intent;
        this.setPaymentIntent(updatedIntent);
        return this.handlePaymentAttempt(this.getPaymentAttempt());
      } else {
        return this.confirmPayment(data);
      }
    });
  }

  handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    return Promise.resolve(true).then(() => {
      switch (paymentAttempt.status) {
        case PaymentAttemptStatus.REQUIRES_IDENTIFICATION: {
          this.callChange();
          return this.handleAdyenAction(paymentAttempt).then((data) => this.confirmPayment(data));
        }

        case PaymentAttemptStatus.REQUIRES_CHALLENGE: {
          this.callChange();
          return this.handleAdyenAction(paymentAttempt).then((data) => this.confirmPayment(data));
        }

        case PaymentAttemptStatus.REQUIRES_REDIRECTION: {
          this.callChange();
          return this.handleRedirect(paymentAttempt);
        }

        case PaymentAttemptStatus.AUTHORIZED: {
          this.callSuccess();
          return true;
        }

        case PaymentAttemptStatus.REFUSED:
        default: {
          throw this.intentError();
        }
      }
    });
  }
}
