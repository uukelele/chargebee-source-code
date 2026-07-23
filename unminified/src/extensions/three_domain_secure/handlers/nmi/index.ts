import AbstractThreeDSecureHandler from '@/extensions/three_domain_secure/handlers/abstract';
import ThreeDSecureHandler from '@/extensions/three_domain_secure/index';
import {
  PaymentAttempt,
  PaymentAttemptStatus,
  PaymentMethodType,
  ConfirmApiInputPayload,
  ThreeDsInfo,
} from '@/extensions/three_domain_secure/common/types';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {validateRawCardDetails, loadScriptUsingPredicate} from '@/extensions/three_domain_secure/common/utils';
import {getCurrencyDivisor} from '@/utils/utility-functions';
import Utils from '@/utils/payments/utils';
import LightBox from '@/extensions/three_domain_secure/common/lightbox';

const NMI_GATEWAY_JS_URL = 'https://secure.networkmerchants.com/js/v1/Gateway.js';

/**
 * Shape of the {@code complete} event payload returned by NMI Gateway.js.
 * Field names are camelCase as emitted by the SDK — these differ from the
 * snake_case parameter names used in the NMI {@code /api/transact.php} API.
 */
interface NmiThreeDSCompleteEvent {
  cavv?: string;
  xid?: string;
  eci?: string;
  /** Maps to {@code cardholder_auth} in transact.php */
  cardHolderAuth?: string;
  /** Maps to {@code three_ds_version} in transact.php */
  threeDsVersion?: string;
  /** Maps to {@code directory_server_id} in transact.php */
  directoryServerId?: string;
}

/**
 * Handles 3D Secure authentication for NMI Direct card payments using NMI's Gateway.js SDK.
 *
 * <p>This handler is activated only when the NMI gateway account has a {@code public_key}
 * configured and 3DS is enabled. It orchestrates the full client-side 3DS challenge via
 * Gateway.js and forwards the resulting verification parameters to the Chargebee backend
 * for final authorisation.
 *
 * <p>NMI-via-PayFurl integrations are intentionally excluded and continue to use
 * {@link Payfurl3DSHandler} via the {@code integration_name} credential check in
 * {@link ThreeDSecureHandler}.
 */
export default class Nmi3DSHandler extends AbstractThreeDSecureHandler {
  private readonly publicKey: string;
  private threeDSecureUI: any = null;
  private nmi3dsStyleEl: HTMLStyleElement | null = null;

  constructor(parent: ThreeDSecureHandler, publicKey: string) {
    super(parent);
    this.publicKey = publicKey;
  }

  validate(): boolean {
    if (!this.paymentInfo.card) {
      throw new CbError(Errors.missingPayPaymentInfo);
    }
    validateRawCardDetails(this.paymentInfo.card);
    return true;
  }

  handlePayment(): void {
    this.loadGatewayScript()
      .then(() => this.run3DSChallenge())
      .then((threeDsInfo) => this.buildConfirmPayload(threeDsInfo))
      .then((payload) => this.confirmPayment(payload))
      .catch((err) => {
        this.callError(err instanceof CbError ? err : new CbError(err));
      });
  }

  /**
   * Loads the NMI Gateway.js script if it has not already been loaded.
   * Uses a predicate to avoid duplicate script injection on repeated invocations.
   */
  private loadGatewayScript(): Promise<boolean> {
    return loadScriptUsingPredicate(NMI_GATEWAY_JS_URL, () => !!(window as any)['Gateway']);
  }

  /**
   * Initiates the NMI Gateway.js 3DS Version 2 challenge flow using the correct
   * {@code get3DSecure().createUI()} API and resolves with the verification parameters
   * once cardholder authentication is complete.
   *
   * <p>The {@code challenge} event is used to reveal the lightbox when NMI needs to
   * display the ACS challenge iframe to the cardholder. Both frictionless ({@code complete}
   * with no preceding {@code challenge}) and challenge flows are handled.
   *
   * <p>A 5-minute timeout guards against Gateway.js never emitting a terminal event
   * (e.g. ACS server stall), which would otherwise leave the promise pending forever.
   */
  private run3DSChallenge(): Promise<ThreeDsInfo> {
    return new Promise((resolve, reject) => {
      const CHALLENGE_TIMEOUT_MS = 5 * 60 * 1000;
      let settled = false;

      const timeoutId = setTimeout(() => {
        if (!settled) {
          settled = true;
          this.cleanupThreeDSecureUI();
          this.kvl({action: 'nmi_3ds_challenge', result: 'timeout'});
          reject(new CbError({name: 'NMI_3DS_FAILED', message: 'NMI 3DS challenge timed out'}));
        }
      }, CHALLENGE_TIMEOUT_MS);

      const settle = (fn: () => void) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          fn();
        }
      };

      // Step 1: Initialize Gateway (per NMI docs https://docs.nmi.com/docs/payer-authentication-3ds)
      const gateway = (window as any)['Gateway'].create(this.publicKey);
      const threeDSecure = gateway.get3DSecure();

      const intent = this.getPaymentIntent();
      const card = this.paymentInfo.card;
      const custBillingAddress = this.getCustomerBillingAddress() || {};
      const customerInfo = (this.getCustomerInfo() as any) || {};
      const amount = (intent.amount / getCurrencyDivisor(intent.currency_code)).toFixed(2);

      // Manual device data per NMI docs — "a try/catch is recommended to future-proof"
      // ES5-safe: no optional chaining or nullish coalescing (avoids predev Babel issues)
      let browserJavaEnabled = String(false);
      try {
        const nav = (window as any).navigator;
        if (nav && typeof nav.javaEnabled === 'function') {
          browserJavaEnabled = String(nav.javaEnabled());
        }
      } catch (e) {
        browserJavaEnabled = String(false);
      }

      this.lightbox = new LightBox(intent.gateway);
      const containerSelector = `#${this.lightbox.getWrapperElId()}`;

      // NMI 3DS container: dimensions sized for sandbox and production challenges without scrollbars
      const wrapperId = this.lightbox.getWrapperElId();
      this.nmi3dsStyleEl = document.createElement('style');
      this.nmi3dsStyleEl.setAttribute('type', 'text/css');
      this.nmi3dsStyleEl.setAttribute('data-cb-nmi-3ds', 'true');
      this.nmi3dsStyleEl.appendChild(
        document.createTextNode(
          '#' +
            wrapperId +
            ' > iframe, #' +
            wrapperId +
            ' > .frame-contents, #' +
            wrapperId +
            ' > div { width: 560px !important; height: 720px !important; min-height: 640px !important; max-height: 90vh !important; overflow-y: auto !important; overflow-x: hidden !important; }'
        )
      );
      document.head.appendChild(this.nmi3dsStyleEl);

      // Step 2: Attach gateway error listener (per NMI docs — errors on gateway, not threeDSecureUI)
      const handleGatewayError = (response: any) => {
        settle(() => {
          this.cleanupThreeDSecureUI();
          const errorObj = response && response.error;
          const message =
            (response && ((errorObj && errorObj.message) || errorObj || response.message)) || 'NMI 3DS error';
          this.kvl({action: 'nmi_3ds_challenge', result: 'error', error: message});
          reject(new CbError({name: 'NMI_3DS_FAILED', message}));
        });
      };
      gateway.on('error', handleGatewayError);

      // Step 3: Create interface with transaction details (NMI docs param order: card, billing, device data)
      const createUIOptions = {
        cardNumber: card.number,
        cardExpMonth: String(card.expiryMonth).length === 1 ? '0' + String(card.expiryMonth) : String(card.expiryMonth),
        cardExpYear: String(card.expiryYear).length === 2 ? String(card.expiryYear) : String(card.expiryYear).slice(-2),
        currency: intent.currency_code,
        amount,
        email: customerInfo.email || '',
        city: custBillingAddress['city'] || '',
        address1: custBillingAddress['addressLine1'] || '',
        country: custBillingAddress['countryCode'] || '',
        firstName: card.firstName || custBillingAddress['firstName'] || '',
        lastName: card.lastName || custBillingAddress['lastName'] || '',
        postalCode: custBillingAddress['zip'] || '',
        state: custBillingAddress['stateCode'] || custBillingAddress['state'] || '',
        phone: custBillingAddress['phone'] || '',
        browserJavaEnabled,
        browserJavascriptEnabled: String(true),
        browserLanguage: window.navigator.language || (window.navigator as any).userLanguage || 'en',
        browserColorDepth: String(window.screen.colorDepth),
        browserScreenHeight: String(window.screen.height),
        browserScreenWidth: String(window.screen.width),
        browserTimeZone: String(new Date().getTimezoneOffset()),
        deviceChannel: 'Browser',
      };

      this.threeDSecureUI = threeDSecure.createUI(createUIOptions);

      // Step 4: Attach callbacks (per NMI docs — challenge, complete, failure)
      this.threeDSecureUI.on('challenge', () => {
        this.lightbox.show();
      });

      this.threeDSecureUI.on('complete', (response: NmiThreeDSCompleteEvent) => {
        settle(() => {
          this.cleanupThreeDSecureUI();
          this.kvl({action: 'nmi_3ds_challenge', result: 'complete'});
          resolve({
            cryptogram: response.cavv,
            xid: response.xid,
            eci: response.eci,
            cardholderAuth: response.cardHolderAuth,
            version: response.threeDsVersion,
            trxid: response.directoryServerId,
          });
        });
      });

      this.threeDSecureUI.on('failure', (response: any) => {
        settle(() => {
          this.cleanupThreeDSecureUI();
          const message = (response && (response.message || response.error)) || 'NMI 3DS authentication failed';
          this.kvl({action: 'nmi_3ds_challenge', result: 'failure', error: message});
          reject(new CbError({name: 'NMI_3DS_FAILED', message}));
        });
      });

      // Step 5: Start — mount to DOM (per NMI docs — "begins the collection of 3DS data")
      this.threeDSecureUI.start(containerSelector);
    });
  }

  /**
   * Unmounts the NMI ThreeDSecureUI and destroys the lightbox container.
   * Calling {@code unmount()} first ensures NMI's internal singleton is properly
   * deregistered before the DOM element is removed, preventing the
   * "ThreeDSecureUI was started but has since been removed from the DOM" error
   * on subsequent payment attempts.
   */
  private cleanupThreeDSecureUI(): void {
    if (this.threeDSecureUI) {
      try {
        this.threeDSecureUI.unmount();
      } catch (e) {
        // unmount may throw if the frame was never mounted (frictionless flow)
      }
      this.threeDSecureUI = null;
    }
    if (this.nmi3dsStyleEl && this.nmi3dsStyleEl.parentNode) {
      this.nmi3dsStyleEl.parentNode.removeChild(this.nmi3dsStyleEl);
      this.nmi3dsStyleEl = null;
    }
    this.removeIframe();
  }

  /**
   * Assembles the {@link ConfirmApiInputPayload} from the raw card data and the 3DS
   * verification result. The {@code threeDsInfo} object is nested inside
   * {@code paymentMethodDetails} so that {@code OpenPayRequestBuilder} in the backend
   * can map it to {@code ThreeDSecureDetails}.
   *
   * <p>The payload is assigned to a local variable before being returned so that
   * TypeScript's excess property checking does not reject the billing address fields
   * nested inside {@code customer} and {@code paymentMethodDetails} — the same pattern
   * used by {@link Base3DSHandler#getConfirmPayload}.
   */
  private buildConfirmPayload(threeDsInfo: ThreeDsInfo): ConfirmApiInputPayload {
    const card = this.paymentInfo.card;
    const pmBillingAddress = this.getCardBillingAddress() || {};
    const custBillingAddress = this.getCustomerBillingAddress() || {};

    const payload = {
      paymentMethodType: PaymentMethodType.CARD,
      browserDetails: Utils.getBrowserDetails(),
      customer: {
        ...(this.getCustomerInfo() || {}),
        ...(custBillingAddress.firstName && {firstName: custBillingAddress.firstName}),
        ...(custBillingAddress.lastName && {lastName: custBillingAddress.lastName}),
        billingAddress: custBillingAddress,
      },
      shippingAddress: this.getShippingAddress(),
      paymentMethodDetails: {
        card,
        firstName: pmBillingAddress.firstName,
        lastName: pmBillingAddress.lastName,
        billingAddress: pmBillingAddress,
        threeDsInfo,
      },
    };

    return payload as ConfirmApiInputPayload;
  }

  /**
   * Handles the payment attempt response from the backend.
   *
   * <p>Since the 3DS challenge is fully resolved client-side by Gateway.js before the
   * confirm call is made, the backend is expected to respond directly with
   * {@code AUTHORIZED} or {@code REFUSED}. No server-initiated challenge redirect is
   * required for this flow.
   */
  protected handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.AUTHORIZED:
        this.callSuccess();
        return Promise.resolve(true);
      case PaymentAttemptStatus.REFUSED:
      default:
        throw this.intentError();
    }
  }
}
