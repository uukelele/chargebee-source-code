import AbstractThreeDSecureHandler from './handlers/abstract';
import CbInstanceOptions from '@/interfaces/cb-instance-options';
import {
  PaymentIntent,
  PaymentInfo,
  Options,
  Callbacks,
  Gateway,
  Orchestrator,
} from '@/extensions/three_domain_secure/common/types';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import CbWindowManager from '@/models/cb-window-manager';
import Ids from '@/constants/ids';
import {Master as M} from '@/hosted_fields/common/enums';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {ThreeDSHandler} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import {constructPaymentIntentApiPayload} from '@/internal/common/utils';
import {PAYMENT_AUTH_REDIRECT_WINDOW_NAME} from '@/hosted_fields/common/base-types';
import {ResponseInnerMessage} from '@/hosted_fields/common/types';
import Helpers from '@/helpers/index';
import {jsonify} from '@/utils/utility-functions';
import {Base3DSConfig, TokenizationType} from './handlers/Common/types';

/* 3DS Payment Handlers */
import Stripe3DSHandler from '@/extensions/three_domain_secure/handlers/stripe';
import Adyen3DSHandler from '@/extensions/three_domain_secure/handlers/adyen';
import Braintree3DSHandler from '@/extensions/three_domain_secure/handlers/braintree';
import CheckoutCom3DSHandler from '@/extensions/three_domain_secure/handlers/checkout';
import Cybersource3DSHandler from '@/extensions/three_domain_secure/handlers/cybersource';
import Bluesnap3DSHandler from '@/extensions/three_domain_secure/handlers/bluesnap';
import IngenicoDirect3DSHandler from '@/extensions/three_domain_secure/handlers/ingenico_direct';
import WorldPay3DSHandler from '@/extensions/three_domain_secure/handlers/worldpay';
import Mollie3DSHandler from '@/extensions/three_domain_secure/handlers/mollie';
import Razorpay3DSHandler from '@/extensions/three_domain_secure/handlers/razorpay';
import BOFA3DSHandler from '@/extensions/three_domain_secure/handlers/bank_of_america';
import PAYFURL3DSHandler from '@/extensions/three_domain_secure/handlers/payfurl';
import Ebanx3DSHandler from '@/extensions/three_domain_secure/handlers/ebanx';
import PayCom3DSHandler from '@/extensions/three_domain_secure/handlers/pay_com';
import {Spreedly3DSHandler} from '@/extensions/three_domain_secure/handlers/spreedly';
import {SpreedlyGlobal3DSHandler} from '@/extensions/three_domain_secure/handlers/spreedly_global';
import {debugMode} from '@/constants/environment';
import ChargebeePayments3DSHandler from '@/extensions/three_domain_secure/handlers/chargebee_payments';
import GlobalPaymentsHandler from '@/extensions/three_domain_secure/handlers/global_payments';
import VantivHandler from './handlers/vantiv';
import HandlerFactory from '@/extensions/three_domain_secure/handlers/Common/Factory/HandlerFactory';
import DeutscheBank3DSHandler from './handlers/deutsche_bank';
import Ecentric3DSHandler from './handlers/ecentric';
import Nmi3DSHandler from './handlers/nmi';

export default class ThreeDSecureHandler implements ThreeDSHandler {
  public site: string;
  public paymentIntent: PaymentIntent;
  public options: Options;
  // Handling history specific settings for chargebee level. We might need to rethink for other sites as well
  public isCbCheckout: boolean;
  public windowManager: CbWindowManager;
  private _3dsHandlerPromise: Promise<AbstractThreeDSecureHandler>;

  constructor(chargebee: CbInstanceOptions) {
    this.site = chargebee.site;
    this.isCbCheckout = chargebee.forCbCheckout;
  }

  public retrievePaymentIntent(paymentIntentId: string): Promise<ResponseInnerMessage> {
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.RetrievePaymentIntent,
          data: {
            paymentIntentId,
          },
        },
        Ids.MASTER_FRAME,
        {timeout: 10000}
      )
    );
  }

  setWindowManager(windowManager: CbWindowManager) {
    this.windowManager = windowManager;
  }

  closeTab() {
    this.windowManager && this.windowManager.close();
  }

  setPaymentIntent(paymentIntent: PaymentIntent, options: Options = {}) {
    this.options = options;
    this.paymentIntent = this.validatePaymentIntent(paymentIntent);
    this._3dsHandlerPromise = this.create3DSHandler(paymentIntent.gateway);
    this._3dsHandlerPromise.catch((e) => {
      if (debugMode()) {
        console.error(e);
        console.trace();
      }
    });
  }

  updatePaymentIntent(paymentIntent) {
    this.paymentIntent = paymentIntent;
  }

  getPaymentIntent(): PaymentIntent {
    return this.paymentIntent;
  }

  hasReturnUrlAtIntent(): boolean {
    return !!(this.getPaymentIntent() && this.getPaymentIntent().success_url);
  }

  // To fix popup limitation on browser
  // https://mychargebee.atlassian.net/wiki/spaces/CHECKOUT/pages/2943680759/Window+Management+in+Chargebee.js
  openNewWindow(override?: any): void {
    if (this.hasReturnUrlAtIntent()) {
      return;
    }
    if (!this.windowManager) {
      this.setWindowManager(new CbWindowManager());
    }
    const options = Object.assign(
      {
        skipReferrer: true,
        showLoader: true,
        openInNewWindow: true,
      },
      override
    );
    if (!this.windowManager.window || this.windowManager.window.closed) {
      this.windowManager.openDirect('', PAYMENT_AUTH_REDIRECT_WINDOW_NAME, options);
    }
  }

  private create3DSHandler(gateway: Gateway) {
    return this.getThreeDSecureHandler(gateway);
  }

  handleCardPayment(paymentInfo: PaymentInfo = {}, callbacks: Callbacks = {}): Promise<PaymentIntent> {
    this._3dsHandlerPromise = this.create3DSHandler(this.paymentIntent.gateway);
    return this._3dsHandlerPromise.then((h) => h.handleCardPayment(paymentInfo, callbacks));
  }

  cancel(reason?: string): Promise<PaymentIntent> {
    return this._3dsHandlerPromise.then((h) => h.cancel(reason));
  }

  validatePaymentIntent(intent: PaymentIntent): PaymentIntent {
    if (typeof intent !== 'object' || !(intent.id && intent.amount + '' && intent.status && intent.gateway))
      throw new CbError(Errors.invalidPaymentIntent);
    return intent;
  }

  private getThreeDSecureHandler(gateway: Gateway): Promise<AbstractThreeDSecureHandler> {
    return Promise.resolve(true).then(() => {
      switch (gateway) {
        case Gateway.STRIPE:
          return new Stripe3DSHandler(this);
        case Gateway.BRAINTREE:
          return new Braintree3DSHandler(this);
        case Gateway.ADYEN:
          return new Adyen3DSHandler(this);
        case Gateway.CHECKOUT_COM:
          return new CheckoutCom3DSHandler(this);
        case Gateway.CYBERSOURCE:
          return new Cybersource3DSHandler(this);
        case Gateway.BLUESNAP:
          return new Bluesnap3DSHandler(this);
        case Gateway.INGENICO_DIRECT:
          return new IngenicoDirect3DSHandler(this);
        case Gateway.WORLDPAY:
          return new WorldPay3DSHandler(this);
        case Gateway.MOLLIE:
          return new Mollie3DSHandler(this);
        case Gateway.RAZORPAY:
          return new Razorpay3DSHandler(this);
        case Gateway.BANK_OF_AMERICA:
          return new BOFA3DSHandler(this);
        case Gateway.PAYCOM:
          return new PayCom3DSHandler(this);
        case Gateway.ECENTRIC:
          return this.getEcentric3DSHandler();
        case Gateway.METRICS_GLOBAL:
        case Gateway.WINDCAVE:
        case Gateway.Nuvei:
          return new PAYFURL3DSHandler(this);
        case Gateway.EBANX:
          return new Ebanx3DSHandler(this);
        case Gateway.GLOBAL_PAYMENTS:
          return new GlobalPaymentsHandler(this);
        case Gateway.CHARGEBEE_PAYMENTS:
          return new ChargebeePayments3DSHandler(this);
        case Gateway.VANTIV:
          return new VantivHandler(this);
        case Gateway.CHARGEBEE:
        case Gateway.SPREEDLY:
          return this.getSpreedly3DSHandler();
        case Gateway.DEUTSCHE_BANK:
          return new DeutscheBank3DSHandler(this);
        case Gateway.NMI:
          return this.getNmi3DSHandler(gateway);
        default:
          return this.getDefault3DSHandler(gateway);
      }
    }) as Promise<AbstractThreeDSecureHandler>;
  }

  private getSpreedly3DSHandler(): Promise<AbstractThreeDSecureHandler> {
    return this.fetchGatewayCredential().then((resp) => {
      if (resp.spreedly_config && resp.spreedly_config.use_global) {
        return new SpreedlyGlobal3DSHandler(this, resp.spreedly_config);
      } else if (resp.integration_name) {
        return this.getOrchestrator3DSHandler(resp.integration_name);
      }
      this.sendKVLForDefaultHanlder('Spreedly3DSHandler');
      return new Spreedly3DSHandler(this);
    });
  }

  /**
   * Selects the correct 3DS handler for NMI, distinguishing between configurations:
   *
   * <ol>
   *   <li>NMI via PayFurl orchestrator ({@code integration_name = "payfurl"}) – delegates to
   *       {@link PAYFURL3DSHandler} to preserve the existing PayFurl 3DS flow.</li>
   *   <li>NMI Direct with 3DS enabled ({@code public_key} present and {@code is_3ds_enabled}) –
   *       uses {@link Nmi3DSHandler} which drives the challenge via NMI's Gateway.js.</li>
   *   <li>NMI Direct without 3DS – falls back to server-side raw card tokenisation via
   *       {@link HandlerFactory} with {@link TokenizationType.Server}.</li>
   * </ol>
   *
   * <p>The {@code spreedly_config.use_global} branch is preserved from the previous default
   * handler path so that the behaviour is identical for any credential response shape that
   * does not originate from a true NMI Direct gateway account.
   */
  private getNmi3DSHandler(gateway: Gateway): Promise<AbstractThreeDSecureHandler> {
    return this.fetchGatewayCredential().then((resp) => {
      if (resp.spreedly_config && resp.spreedly_config.use_global) {
        return new SpreedlyGlobal3DSHandler(this, resp.spreedly_config);
      }

      if (resp.integration_name) {
        return this.getOrchestrator3DSHandler(resp.integration_name);
      }

      if (resp.public_key && resp.is_3ds_enabled) {
        return new Nmi3DSHandler(this, resp.public_key);
      }

      const config: Base3DSConfig = {
        supported_flows: ['card', 'cardComponent', 'reference_id'],
        challenge_window: 'iframe',
        gateway: gateway,
        cardHolderInfoRequired: true,
        tokenization_type: TokenizationType.Server,
      };
      return new HandlerFactory(config).createHandler(this);
    });
  }

  /**
   * Selects the correct 3DS handler for Ecentric, distinguishing between configurations:
   *
   * <ol>
   *   <li>Ecentric via an orchestrator ({@code integration_name} present, e.g. PayFurl) – delegates
   *       to {@link getOrchestrator3DSHandler} so the existing Ecentric-via-PayFurl flow is preserved.</li>
   *   <li>Ecentric Direct ({@code integration_name} absent) – uses {@link Ecentric3DSHandler}, which
   *       drives the ACS challenge via the server-issued action payload.</li>
   * </ol>
   *
   * <p>{@code FetchGwPubCredential} only returns {@code integration_name} for orchestrator-backed
   * gateways, so a direct Ecentric account yields a credential response without it and falls through
   * to the direct handler.</p>
   */
  private getEcentric3DSHandler(): Promise<AbstractThreeDSecureHandler> {
    return this.fetchGatewayCredential().then((resp) => {
      const integrationName = resp && resp.integration_name;
      if (typeof integrationName === 'string' && integrationName.trim() !== '') {
        return this.getOrchestrator3DSHandler(integrationName);
      }
      return new Ecentric3DSHandler(this);
    });
  }

  private getDefault3DSHandler(gateway): Promise<AbstractThreeDSecureHandler> {
    return this.fetchGatewayCredential().then((resp) => {
      if (resp.spreedly_config && resp.spreedly_config.use_global) {
        return new SpreedlyGlobal3DSHandler(this, resp.spreedly_config);
      } else if (resp.integration_name) {
        return this.getOrchestrator3DSHandler(resp.integration_name);
      }
      this.sendKVLForDefaultHanlder('default3DSHandler');

      const config: Base3DSConfig = {
        supported_flows: ['card', 'cardComponent', 'reference_id', 'paymentComponent'],
        challenge_window: 'iframe', // iframe or tab
        gateway: gateway,
        cardHolderInfoRequired: gateway !== Gateway.EZIDEBIT, // skip firstName & lastName validation for EZIDEBIT
        tokenization_type: TokenizationType.Server,
      };
      if (config.challenge_window == 'tab') {
        this.openNewWindow();
      }

      const handlerFactory = new HandlerFactory(config);
      return handlerFactory.createHandler(this);
    });
  }

  private getOrchestrator3DSHandler(integrationName): AbstractThreeDSecureHandler {
    if (integrationName.toLowerCase() === Orchestrator.PAYFURL) {
      return new PAYFURL3DSHandler(this);
    } else {
      this.sendKVLForDefaultHanlder('Orchestrator');
      return new Spreedly3DSHandler(this);
    }
  }

  protected fetchGatewayCredential(): Promise<any> {
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.FetchGatewayCredential,
          data: constructPaymentIntentApiPayload(this.getPaymentIntent()),
        },
        Ids.MASTER_FRAME,
        {timeout: 10000}
      )
    );
  }

  private sendKVLForDefaultHanlder(handler) {
    const intent = this.getPaymentIntent();

    this.kvl({
      action: 'default_3ds_handler',
      handler,
      site_meta: Helpers.getSiteMetaData(),
      paymentIntent: {
        id: intent.id,
        status: intent.status,
        gatewayName: intent.gateway,
        gatewayAccountId: intent.gateway_account_id,
        paymentMethodType: intent.payment_method_type,
      },
    });
  }

  protected kvl(data): Promise<any> {
    const payload = {
      ...jsonify(data),
    };
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.CaptureKVL,
          data: payload,
        },
        Ids.MASTER_FRAME
      )
    );
  }
}

// @ts-ignore
// window.Chargebee3dsHelper = threeDSecure;
