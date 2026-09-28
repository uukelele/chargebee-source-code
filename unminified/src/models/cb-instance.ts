import Product from '@/models/product';
import Cart from '@/models/cart';
import {StyleConfig, CbAnchorElement, CbCallbacksInterface} from '@/interfaces/cb-types';
import Handler from '@/models/handler';
import {PageType} from '@/constants/enums';
import {PortalSession} from '@/interfaces/cb-types';
import CbInstanceOptions from '@/interfaces/cb-instance-options';
import Helpers from '@/helpers/index';
import AuthHandler from '@/models/auth-handler';
import Page from '@/models/page';
import ChargebeePortal from '@/models/chargebee-portal';
import {
  Component,
  ComponentType,
  ThreeDSHandler,
  IDealPayment,
  SofortPayment,
  PayCoPayment,
  GrabPayPayment,
  GoPayPayment,
  TwintPayment,
  KbcPaymentButtonPayment,
  ElectronicPaymentStandardPayment,
  TrustlyPayment,
  PayByBankPayment,
  CashAppPayPayment,
  WechatPayPayment,
  AlipayPayment,
  AlipayHkPayment,
  GcashPayment,
  MomoPayment,
  RakutenPayPayment,
  StablecoinPayment,
  GooglePayment,
  BancontactPayment,
  GiropayPayment,
  DotpayPayment,
  ApplePayment,
  PaypalPayment,
  NetbankingPayment,
  UpiPayment,
  PixPayment,
  OvoPayment,
  MercadoPagoPayment,
  NupayPayment,
  PicpayPayment,
  ThaiQrPayment,
  NequiPayment,
  DirectDebitPayment,
  BoletoPayment,
  TabRedirectPayments,
  PaymentOptions,
  PAYMENT_AUTH_REDIRECT_WINDOW_NAME,
  AmazonPayPayment,
  VenmoPayment,
  FasterPymtsPayment,
  PayToPayment,
  SepaInstantTransferPayment,
  KlarnaPayNowPayment,
  KlarnaPayment,
  OnlineBankingPolandPayment,
  PayconiqByBancontactPayment,
  KakaoPayPayment,
  NaverPayPayment,
  RevolutPayPayment,
  SwishPayment,
  PaymePayment,
  DanaPayment,
  TouchNGoPayment,
  TamaraPayment,
  QpayPayment,
  ComponentTypeRaw,
  PaypayPayment,
  SouthKoreanCardsPayment,
  BizumPayment,
  PayNowPayment,
  PromptPayPayment,
} from '@/hosted_fields/common/base-types';
import Assert from '@/helpers/asserts';
import {PaymentIntent, AdditionalData, Callbacks} from '@/extensions/three_domain_secure/common/types';
import ComponentsAndFieldsLoaderInterface from '@/plugins/components_fields/loader/interface';
import ThreeDSLoaderInterface from '@/plugins/three_domain_secure/loader/interface';
import FunctionsPluginLoaderInterface, {
  EstimateFunctionsPluginLoaderInterface,
  VatValidationFunctionsPluginLoaderInterface,
} from '@/plugins/functions/loader/interface';
import {Info as JsInfo} from '@/plugins/checkout_utils/types';
import IframeClientLoader, {sendToMasterIframe} from '@/hosted_fields/host/iframe-client-loader';
import IDealPaymentLoaderInterface from '@/plugins/payments/iDeal/loader/interface';
import SofortPaymentLoaderInterface from '@/plugins/payments/sofort/loader/interface';
import PayCoPaymentLoaderInterface from '@/plugins/payments/pay_co/loader/interface';
import GrabPayPaymentLoaderInterface from '@/plugins/payments/grab_pay/loader/interface';
import GoPayPaymentLoaderInterface from '@/plugins/payments/go_pay/loader/interface';
import TwintPaymentLoaderInterface from '@/plugins/payments/twint/loader/interface';
import TrustlyPaymentLoaderInterface from '@/plugins/payments/trustly/loader/interface';
import KbcPaymentButtonPaymentLoaderInterface from '@/plugins/payments/kbc_payment_button/loader/interface';
import ElectronicPaymentStandardPaymentLoaderInterface from '@/plugins/payments/electronic_payment_standard/loader/interface';
import PayByBankPaymentLoaderInterface from '@/plugins/payments/pay_by_bank/loader/interface';
import AlipayPaymentLoaderInterface from '@/plugins/payments/alipay/loader/interface';
import AlipayHkPaymentLoaderInterface from '@/plugins/payments/alipay_hk/loader/interface';
import GcashPaymentLoaderInterface from '@/plugins/payments/gcash/loader/interface';
import MomoPaymentLoaderInterface from '@/plugins/payments/momo/loader/interface';
import RakutenPayPaymentLoaderInterface from '@/plugins/payments/rakuten_pay/loader/interface';
import StablecoinPaymentLoaderInterface from '@/plugins/payments/stablecoin/loader/interface';
import GooglePaymentLoaderInterface from '@/plugins/payments/google_pay/loader/interface';
import BancontactPaymentLoaderInterface from '@/plugins/payments/bancontact/loader/interface';
import GiropayPaymentLoaderInterface from '@/plugins/payments/giropay/loader/interface';
import DotpayPaymentLoaderInterface from '@/plugins/payments/dotpay/loader/interface';
import PaypalPaymentLoaderInterface from '@/plugins/payments/paypal_express_checkout/loader/interface';
import NetbankingPaymentLoaderInterface from '@/plugins/payments/netbanking_emandates/loader/interface';
import ApplepayPaymentLoaderInterface from '@/plugins/payments/apple_pay/loader/interface';
import AmazonpayPaymentLoaderInterface from '@/plugins/payments/amazon_payments/loader/interface';
import UpiPaymentLoaderInterface from '@/plugins/payments/upi/loader/interface';
import PixPaymentLoaderInterface from '@/plugins/payments/pix/loader/interface';
import OvoPaymentLoaderInterface from '@/plugins/payments/ovo/loader/interface';
import MercadoPagoPaymentLoaderInterface from '@/plugins/payments/mercado_pago/loader/interface';
import NupayPaymentLoaderInterface from '@/plugins/payments/nupay/loader/interface';
import PicpayPaymentLoaderInterface from '@/plugins/payments/picpay/loader/interface';
import DirectDebitPaymentLoaderInterface from '@/plugins/payments/direct_debit/loader/interface';
import FasterPymtsLoaderInterface from '@/plugins/payments/faster_payments/loader/interface';
import PayToPaymentLoaderInterface from '@/plugins/payments/pay_to/loader/interface';
import SepaInstantTransferPaymentLoaderInterface from '@/plugins/payments/sepa_instant_transfer/loader/interface';
import BoletoPaymentLoaderInterface from '@/plugins/payments/boleto/loader/interface';
import KakaoPayPaymentLoaderInterface from '@/plugins/payments/kakao_pay/loader/interface';
import NaverPayPaymentLoaderInterface from '@/plugins/payments/naver_pay/loader/interface';
import WechatPayPaymentLoaderInterface from '@/plugins/payments/wechat_pay/loader/interface';
import CashAppPayPaymentLoaderInterface from '@/plugins/payments/cash_app_pay/loader/interface';
import RevolutPayPaymentLoaderInterface from '@/plugins/payments/revolut_pay/loader/interface';
import PaypayPaymentLoaderInterface from '@/plugins/payments/paypay/loader/interface';
import SouthKoreanCardsPaymentLoaderInterface from '@/plugins/payments/south_korean_cards/loader/interface';
import CbWindowManager from './cb-window-manager';
import {ComponentOptions, Locale, ResponseInnerMessage} from '@/hosted_fields/common/types';
import VenmoPaymentLoaderInterface from '@/plugins/payments/venmo/loader/interface';
import {Master} from '@/hosted_fields/common/enums';
import Ids from '@/constants/ids';
import {CaptchaProviderName, RecaptchaOptions} from '@/plugins/captcha/types';
import HostedPagePlugin from '@/plugins/hosted_page/host/';
import {
  CheckoutOptions,
  OpenCheckoutOptions,
  SetCheckoutCallbacks as CbCheckoutCallbacks,
  SetPortalCallbacks,
} from '@/hosted_page/host/checkout/types';
import {Checkout} from '@/hosted_page/host/checkout';
import KlarnaPayNowLoaderInterface from '@/plugins/payments/klarna_pay_now/loader/interface';
import KlarnaPaymentLoaderInterface from '@/plugins/payments/klarna/loader/interface';
import OnlineBankingPolandPaymentLoaderInterface from '@/plugins/payments/online_banking_poland/loader/interface';
import {Components} from '@chargebee/components';
import EnvConstants from '@/constants/environment';
import {CancelPage} from '@/interfaces/cb-cancel-page';
import {PricingTable} from '@/interfaces/cb-pricing-table';
import {PersonalizedOffers} from '@/interfaces/cb-personalized-offers';
import PayconiqByBancontactPaymentLoaderInterface from '@/plugins/payments/payconiq_by_bancontact/loader/interface';
import SwishPaymentLoaderInterface from '@/plugins/payments/swish/loader/interface';
import PaymePaymentLoaderInterface from '@/plugins/payments/payme/loader/interface';
import DanaPaymentLoaderInterface from '@/plugins/payments/dana/loader/interface';
import TouchNGoPaymentLoaderInterface from '@/plugins/payments/touch_n_go/loader/interface';
import TamaraPaymentLoaderInterface from '@/plugins/payments/tamara/loader/interface';
import QpayPaymentLoaderInterface from '@/plugins/payments/qpay/loader/interface';
import BizumPaymentLoaderInterface from '@/plugins/payments/bizum/loader/interface';
import PayNowPaymentLoaderInterface from '@/plugins/payments/paynow/loader/interface';
import PromptPayPaymentLoaderInterface from '@/plugins/payments/promptpay/loader/interface';
import ThaiQrPaymentLoaderInterface from '@/plugins/payments/thai_qr/loader/interface';
import NequiPaymentLoaderInterface from '@/plugins/payments/nequi/loader/interface';

export default class CbInstance {
  /** @internal */
  atomicPricingLoad: Promise<any>;

  /** @internal */
  retentionLoad: Promise<any>;

  /** @internal */
  site: string;

  /** @internal */
  domain: string;

  /** @internal */
  authenticated: boolean;

  /** @internal */
  authHandler: AuthHandler;

  /** @internal */
  enableRedirectMode: boolean;

  /** @internal */
  enableGATracking: boolean;

  /** @internal */
  enableFBQTracking: boolean;

  /** @internal */
  enableRefersionTracking: boolean;

  /** @internal */
  enableGTMTracking: boolean;

  /** @internal */
  enableFriendbuyTracking: boolean;

  /** @internal */
  enableTopLevelRedirectOnSuccess: boolean;

  /** @internal */
  portalCallbacks: CbCallbacksInterface;

  /** @internal */
  publishableKey: string;

  /** @internal */
  recaptchaKey: string;

  /** @internal */
  isItemsModel: boolean;

  /** @internal */
  businessEntityId: string;

  /** @internal */
  brandId: string;

  /** @internal */
  cspNonce: string;

  /** @internal */
  hostedPagePlugin: HostedPagePlugin;

  /** @internal */
  componentLoader: ComponentsAndFieldsLoaderInterface;

  /** @internal */
  threeDSLoader: ThreeDSLoaderInterface;

  /** @internal */
  functionsPluginLoader: FunctionsPluginLoaderInterface;

  /** @internal */
  iDealPaymentLoader: IDealPaymentLoaderInterface;

  /** @internal */
  sofortPaymentLoader: SofortPaymentLoaderInterface;

  /** @internal */
  stablecoinPaymentLoader: StablecoinPaymentLoaderInterface;

  /** @internal */
  payByBankPaymentLoader: PayByBankPaymentLoaderInterface;

  /** @internal */
  trustlyPaymentLoader: TrustlyPaymentLoaderInterface;

  /** @internal */
  kbcPaymentButtonPaymentLoader: KbcPaymentButtonPaymentLoaderInterface;

  /** @internal */
  electronicPaymentStandardPaymentLoader: ElectronicPaymentStandardPaymentLoaderInterface;

  /** @internal */
  googlePaymentLoader: GooglePaymentLoaderInterface;

  /** @internal */
  bancontactPaymentLoader: BancontactPaymentLoaderInterface;

  /** @internal */
  giropayPaymentLoader: GiropayPaymentLoaderInterface;

  /** @internal */
  dotpayPaymentLoader: DotpayPaymentLoaderInterface;

  /** @internal */
  fasterPymtsPaymentLoader: FasterPymtsLoaderInterface;

  /** @internal */
  payToPaymentLoader: PayToPaymentLoaderInterface;

  /** @internal */
  sepaInstantTransferPaymentLoader: SepaInstantTransferPaymentLoaderInterface;

  /** @internal */
  paypalPaymentLoader: PaypalPaymentLoaderInterface;

  /** @internal */
  paymePaymentLoader: PaymePaymentLoaderInterface;

  /** @internal */
  swishPaymentLoader: SwishPaymentLoaderInterface;

  /** @internal */
  bizumPaymentLoader: BizumPaymentLoaderInterface;

  /** @internal */
  paynowPaymentLoader: PayNowPaymentLoaderInterface;

  /** @internal */
  promptpayPaymentLoader: PromptPayPaymentLoaderInterface;

  /** @internal */
  netbankingPaymentLoader: NetbankingPaymentLoaderInterface;

  /** @internal */
  applepayPaymentLoader: ApplepayPaymentLoaderInterface;

  /** @internal */
  alipayPaymentLoader: AlipayPaymentLoaderInterface;

  /** @internal */
  alipayHkPaymentLoader: AlipayHkPaymentLoaderInterface;

  /** @internal */
  gcashPaymentLoader: GcashPaymentLoaderInterface;

  /** @internal */
  momoPaymentLoader: MomoPaymentLoaderInterface;

  /** @internal */
  rakutenPayPaymentLoader: RakutenPayPaymentLoaderInterface;

  /** @internal */
  upiPaymentLoader: UpiPaymentLoaderInterface;

  /** @internal */
  pixPaymentLoader: PixPaymentLoaderInterface;

  /** @internal */
  ovoPaymentLoader: OvoPaymentLoaderInterface;

  /** @internal */
  mercadoPagoPaymentLoader: MercadoPagoPaymentLoaderInterface;

  /** @internal */
  nupayPaymentLoader: NupayPaymentLoaderInterface;

  /** @internal */
  picpayPaymentLoader: PicpayPaymentLoaderInterface;

  /** @internal */
  thaiQrPaymentLoader: ThaiQrPaymentLoaderInterface;

  /** @internal */
  nequiPaymentLoader: NequiPaymentLoaderInterface;

  /** @internal */
  directDebitPaymentLoader: DirectDebitPaymentLoaderInterface;

  /** @internal */
  venmoPaymentLoader: VenmoPaymentLoaderInterface;

  /** @internal */
  boletoPaymentLoader: BoletoPaymentLoaderInterface;

  /** @internal */
  amazonpayPaymentLoader: AmazonpayPaymentLoaderInterface;

  /** @internal */
  klarnaPayNowLoader: KlarnaPayNowLoaderInterface;
  klarnaPaymentLoader: KlarnaPaymentLoaderInterface;

  /** @internal */
  onlineBankingPolandPaymentLoader: OnlineBankingPolandPaymentLoaderInterface;

  /** @internal */
  payconiqByBancontactPaymentLoader: PayconiqByBancontactPaymentLoaderInterface;

  /** @internal */
  twintPaymentLoader: TwintPaymentLoaderInterface;

  /** @internal */
  goPayPaymentLoader: GoPayPaymentLoaderInterface;

  /** @internal */
  grabPayPaymentLoader: GrabPayPaymentLoaderInterface;

  /** @internal */
  payCoPaymentLoader: PayCoPaymentLoaderInterface;

  /** @internal */
  kakaoPayPaymentLoader: KakaoPayPaymentLoaderInterface;

  /** @internal */
  naverPayPaymentLoader: NaverPayPaymentLoaderInterface;

  /** @internal */
  wechatPayPaymentLoader: WechatPayPaymentLoaderInterface;

  /** @internal */
  cashAppPayPaymentLoader: CashAppPayPaymentLoaderInterface;

  /** @internal */
  revolutPayPaymentLoader: RevolutPayPaymentLoaderInterface;

  /** @internal */
  danaPaymentLoader: DanaPaymentLoaderInterface;

  /** @internal */
  touchNGoPaymentLoader: TouchNGoPaymentLoaderInterface;

  /** @internal */
  tamaraPaymentLoader: TamaraPaymentLoaderInterface;

  /** @internal */
  qpayPaymentLoader: QpayPaymentLoaderInterface;

  /** @internal */
  PaypayPaymentLoader: PaypayPaymentLoaderInterface;

  /** @internal */
  SouthKoreanCardsPaymentLoader: SouthKoreanCardsPaymentLoaderInterface;

  /** @internal */
  options: CbInstanceOptions;

  /** @internal */
  checkoutCallbacks: (cart: Cart) => CbCheckoutCallbacks;

  /** @internal */
  styleConfig: StyleConfig = {};

  cart: Cart;

  estimates: EstimateFunctionsPluginLoaderInterface;

  vat: VatValidationFunctionsPluginLoaderInterface;

  /** @internal */
  hp_token: string;

  /** @internal */
  constructor(options: CbInstanceOptions) {
    this.site = options.site;
    this.options = options;
    if (!this.site) {
      throw new Error('Site name is not set');
    }
    this.domain = options.domain;
    this.publishableKey = options.publishableKey;
    this.enableRedirectMode = options.enableRedirectMode;
    this.enableTopLevelRedirectOnSuccess = options.enableTopLevelRedirectOnSuccess;
    this.enableGATracking = options.enableGATracking;
    this.enableFBQTracking = options.enableFBQTracking;
    this.enableRefersionTracking = options.enableRefersionTracking;
    this.enableFriendbuyTracking = options.enableFriendbuyTracking;
    this.enableGTMTracking = options.enableGTMTracking;
    this.recaptchaKey = options.recaptchaKey;
    this.isItemsModel = options.isItemsModel;
    this.cspNonce = options.cspNonce;
    let cbContainer = Helpers.createContainer();
    cbContainer.cbInstance = this;
    this.authHandler = new AuthHandler(this);
    this.cart = new Cart();
    this.cart.setBusinessEntity(options.businessEntityId);
    this.cart.setBrand(options.brandId);
    options.portalSession && this.setPortalSession(options.portalSession);

    // Initialize communication manager (master)
    this.initCommunicationManager();
    // loadTranslations(options.locale);
  }

  /** @internal */
  private initCommunicationManager() {
    IframeClientLoader.then((cbIframeClient) => cbIframeClient.createMasterFrame());
  }

  setBusinessEntity(businessEntityId: string): Promise<ResponseInnerMessage> {
    return sendToMasterIframe('setBusinessEntity', {
      businessEntityId,
    });
  }

  setBrand(brandId: string): Promise<ResponseInnerMessage> {
    return sendToMasterIframe('setBrand', {
      brandId,
    });
  }

  /**
   * Returns an instance of Components SDK
   * @param options
   */
  components(options: unknown) {
    return new Components(options, EnvConstants.COMPONENTS);
  }

  load(chunkName: string) {
    switch (chunkName) {
      case 'components':
        return this.loadComponentsModule();
      case '3ds-handler':
        return this.load3DSHandler().then(() => true);
      case 'functions':
        return this.loadFunctionsPlugin();
      case 'ideal':
        return this.loadIDeal();
      case 'sofort':
        return this.loadSofort();
      case 'google-pay':
        return this.loadGooglePay();
      case 'bancontact':
        return this.loadBancontact();
      case 'giropay':
        return this.loadGiropay();
      case 'dotpay':
        return this.loadDotpay();
      case 'paypal':
        return this.loadPaypal();
      case 'netbanking_emandates':
        return this.loadNetbanking();
      case 'apple-pay':
        return this.loadApplepay();
      case 'upi':
        return this.loadUpi();
      case 'pix':
        return this.loadPix();
      case 'ovo':
        return this.loadOvo();
      case 'mercado_pago':
        return this.loadMercadoPago();
      case 'nupay':
        return this.loadNupay();
      case 'picpay':
        return this.loadPicpay();
      case 'thai_qr':
        return this.loadThaiQr();
      case 'nequi':
        return this.loadNequi();
      case 'direct_debit':
        return this.loadDirectDebit();
      case 'boleto':
        return this.loadBoleto();
      case 'amazon-pay':
        return this.loadAmazonpay();
      case 'venmo':
        return this.loadVenmo();
      case 'faster_payments':
        return this.loadFasterPayments();
      case 'pay_to':
        return this.loadPayTo();
      case 'sepa_instant_transfer':
        return this.loadSepaInstantTransfer();
      case 'klarna_pay_now':
        return this.loadKlarnaPayNow();
      case 'klarna':
        return this.loadKlarna();
      case 'online_banking_poland':
        return this.loadOnlineBankingPoland();
      case 'payconiq_by_bancontact':
        return this.loadPayconiqByBancontact();
      case 'pay_co':
        return this.loadPayCo();
      case 'grab_pay':
        return this.loadGrabPay();
      case 'go_pay':
        return this.loadGoPay();
      case 'twint':
        return this.loadTwint();
      case 'kbc_payment_button':
        return this.loadKbcPaymentButton();
      case 'electronic_payment_standard':
        return this.loadElectronicPaymentStandard();
      case 'trustly':
        return this.loadTrustly();
      case 'pay_by_bank':
        return this.loadPayByBank();
      case 'stablecoin':
        return this.loadStablecoin();
      case 'kakao_pay':
        return this.loadKakaoPay();
      case 'naver_pay':
        return this.loadNaverPay();
      case 'revolut_pay':
        return this.loadRevolutPay();
      case 'alipay':
        return this.loadAlipay();
      case 'alipay_hk':
        return this.loadAlipayHk();
      case 'gcash':
        return this.loadGcash();
      case 'cash_app_pay':
        return this.loadCashAppPay();
      case 'wechat_pay':
        return this.loadWechatPay();
      case 'paypay':
        return this.loadpaypay();
      case 'south_korean_cards':
        return this.loadSouthKoreanCards();
      case 'payme':
        return this.loadPayme();
      case 'swish':
        return this.loadSwishPay();
      case 'dana':
        return this.loadDana();
      case 'touch_n_go':
        return this.loadTouchNGo();
      case 'tamara':
        return this.loadTamara();
      case 'qpay':
        return this.loadQpay();
      case 'bizum':
        return this.loadBizum();
      case 'paynow':
        return this.loadPayNow();
      case 'promptpay':
        return this.loadPromptPay();
      case 'momo':
        return this.loadMomo();
      case 'rakuten_pay':
        return this.loadRakutenPay();
      default:
        throw new Error('Module ' + chunkName + ' not supported');
    }
  }

  /** @internal */
  loadFunctionsPlugin() {
    if (this.functionsPluginLoader) return Promise.resolve(this.functionsPluginLoader);
    return import(/* webpackChunkName: "functions-plugin-loader" */ '@/plugins/functions/loader').then(() => {
      this.estimates = this.functionsPluginLoader.estimates;
      this.vat = this.functionsPluginLoader.vat;
    });
  }

  load3DSHandler(): Promise<ThreeDSHandler> {
    if (this.threeDSLoader) return Promise.resolve(this.threeDSLoader.init());

    return import(/* webpackChunkName: "three-ds-loader" */ '@/plugins/three_domain_secure/loader')
      .then(() => this.threeDSLoader.loaderPromise)
      .then(() => this.threeDSLoader.init());
  }

  /** @internal */
  loadIDeal(): Promise<IDealPayment> {
    if (this.iDealPaymentLoader) return Promise.resolve(this.iDealPaymentLoader.init());

    return import(/* webpackChunkName: "iDeal-loader" */ '@/plugins/payments/iDeal/loader')
      .then(() => this.iDealPaymentLoader.loaderPromise)
      .then(() => this.iDealPaymentLoader.init());
  }

  /** @internal */
  loadSofort(): Promise<SofortPayment> {
    if (this.sofortPaymentLoader) return Promise.resolve(this.sofortPaymentLoader.init());

    return import(/* webpackChunkName: "sofort-loader" */ '@/plugins/payments/sofort/loader')
      .then(() => this.sofortPaymentLoader.loaderPromise)
      .then(() => this.sofortPaymentLoader.init());
  }

  /** @internal */
  loadStablecoin(): Promise<StablecoinPayment> {
    if (this.stablecoinPaymentLoader) return Promise.resolve(this.stablecoinPaymentLoader.init());

    return import(/* webpackChunkName: "stablecoin-loader" */ '@/plugins/payments/stablecoin/loader')
      .then(() => this.stablecoinPaymentLoader.loaderPromise)
      .then(() => this.stablecoinPaymentLoader.init());
  }

  /** @internal */
  loadPayByBank(): Promise<PayByBankPayment> {
    if (this.payByBankPaymentLoader) return Promise.resolve(this.payByBankPaymentLoader.init());

    return import(/* webpackChunkName: "pay-by-bank-loader" */ '@/plugins/payments/pay_by_bank/loader')
      .then(() => this.payByBankPaymentLoader.loaderPromise)
      .then(() => this.payByBankPaymentLoader.init());
  }

  /** @internal */
  loadTrustly(): Promise<TrustlyPayment> {
    if (this.trustlyPaymentLoader) return Promise.resolve(this.trustlyPaymentLoader.init());

    return import(/* webpackChunkName: "trustly-loader" */ '@/plugins/payments/trustly/loader')
      .then(() => this.trustlyPaymentLoader.loaderPromise)
      .then(() => this.trustlyPaymentLoader.init());
  }

  /** @internal */
  loadGooglePay(): Promise<GooglePayment> {
    if (this.googlePaymentLoader) return Promise.resolve(this.googlePaymentLoader.init());

    return import(/* webpackChunkName: "google-pay-loader" */ '@/plugins/payments/google_pay/loader')
      .then(() => this.googlePaymentLoader.loaderPromise)
      .then(() => this.googlePaymentLoader.init());
  }

  /** @internal */
  loadBancontact(): Promise<BancontactPayment> {
    if (this.bancontactPaymentLoader) return Promise.resolve(this.bancontactPaymentLoader.init());

    return import(/* webpackChunkName: "bancontact-loader" */ '@/plugins/payments/bancontact/loader')
      .then(() => this.bancontactPaymentLoader.loaderPromise)
      .then(() => this.bancontactPaymentLoader.init());
  }

  /** @internal */
  loadGiropay(): Promise<GiropayPayment> {
    if (this.giropayPaymentLoader) return Promise.resolve(this.giropayPaymentLoader.init());

    return import(/* webpackChunkName: "giropay-loader" */ '@/plugins/payments/giropay/loader')
      .then(() => this.giropayPaymentLoader.loaderPromise)
      .then(() => this.giropayPaymentLoader.init());
  }

  /** @internal */
  loadDotpay(): Promise<DotpayPayment> {
    if (this.dotpayPaymentLoader) return Promise.resolve(this.dotpayPaymentLoader.init());

    return import(/* webpackChunkName: "dotpay-loader" */ '@/plugins/payments/dotpay/loader')
      .then(() => this.dotpayPaymentLoader.loaderPromise)
      .then(() => this.dotpayPaymentLoader.init());
  }

  /** @internal */
  loadPaypal(): Promise<PaypalPayment> {
    if (this.paypalPaymentLoader) return Promise.resolve(this.paypalPaymentLoader.init());

    return import(/* webpackChunkName: "paypal-loader" */ '@/plugins/payments/paypal_express_checkout/loader')
      .then(() => this.paypalPaymentLoader.loaderPromise)
      .then(() => this.paypalPaymentLoader.init());
  }

  /** @internal */
  loadVenmo(): Promise<VenmoPayment> {
    if (this.venmoPaymentLoader) return Promise.resolve(this.venmoPaymentLoader.init());

    return import(/* webpackChunkName: "venmo-loader" */ '@/plugins/payments/venmo/loader')
      .then(() => this.venmoPaymentLoader.loaderPromise)
      .then(() => this.venmoPaymentLoader.init());
  }

  /** @internal */
  loadNetbanking(): Promise<NetbankingPayment> {
    if (this.netbankingPaymentLoader) return Promise.resolve(this.netbankingPaymentLoader.init());

    return import(/* webpackChunkName: "dotpay-loader" */ '@/plugins/payments/netbanking_emandates/loader')
      .then(() => this.netbankingPaymentLoader.loaderPromise)
      .then(() => this.netbankingPaymentLoader.init());
  }

  /** @internal */
  loadApplepay(): Promise<ApplePayment> {
    if (this.applepayPaymentLoader) return Promise.resolve(this.applepayPaymentLoader.init());

    return import(/* webpackChunkName: "applepay-loader" */ '@/plugins/payments/apple_pay/loader')
      .then(() => this.applepayPaymentLoader.loaderPromise)
      .then(() => this.applepayPaymentLoader.init());
  }

  /** @internal */
  loadAlipay(): Promise<AlipayPayment> {
    if (this.alipayPaymentLoader) return Promise.resolve(this.alipayPaymentLoader.init());

    return import(/* webpackChunkName: "alipay-loader" */ '@/plugins/payments/alipay/loader')
      .then(() => this.alipayPaymentLoader.loaderPromise)
      .then(() => this.alipayPaymentLoader.init());
  }

  /** @internal */
  loadAlipayHk(): Promise<AlipayHkPayment> {
    if (this.alipayHkPaymentLoader) return Promise.resolve(this.alipayHkPaymentLoader.init());

    return import(/* webpackChunkName: "alipay-hk-loader" */ '@/plugins/payments/alipay_hk/loader')
      .then(() => this.alipayHkPaymentLoader.loaderPromise)
      .then(() => this.alipayHkPaymentLoader.init());
  }

  /** @internal */
  loadGcash(): Promise<GcashPayment> {
    if (this.gcashPaymentLoader) return Promise.resolve(this.gcashPaymentLoader.init());

    return import(/* webpackChunkName: "gcash-loader" */ '@/plugins/payments/gcash/loader')
      .then(() => this.gcashPaymentLoader.loaderPromise)
      .then(() => this.gcashPaymentLoader.init());
  }

  /** @internal */
  loadMomo(): Promise<MomoPayment> {
    if (this.momoPaymentLoader) return Promise.resolve(this.momoPaymentLoader.init());
    return import(/* webpackChunkName: "momo-loader" */ '@/plugins/payments/momo/loader')
      .then(() => this.momoPaymentLoader.loaderPromise)
      .then(() => this.momoPaymentLoader.init());
  }

  /** @internal */
  loadRakutenPay(): Promise<RakutenPayPayment> {
    if (this.rakutenPayPaymentLoader) return Promise.resolve(this.rakutenPayPaymentLoader.init());
    return import(/* webpackChunkName: "rakuten-pay-loader" */ '@/plugins/payments/rakuten_pay/loader')
      .then(() => this.rakutenPayPaymentLoader.loaderPromise)
      .then(() => this.rakutenPayPaymentLoader.init());
  }

  loadAmazonpay(): Promise<AmazonPayPayment> {
    if (this.amazonpayPaymentLoader) return Promise.resolve(this.amazonpayPaymentLoader.init());

    return import(/* webpackChunkName: "amazonpay-loader" */ '@/plugins/payments/amazon_payments/loader')
      .then(() => this.amazonpayPaymentLoader.loaderPromise)
      .then(() => this.amazonpayPaymentLoader.init());
  }

  /** @internal */
  loadUpi(): Promise<UpiPayment> {
    if (this.upiPaymentLoader) return Promise.resolve(this.upiPaymentLoader.init());

    return import(/* webpackChunkName: "upi-loader" */ '@/plugins/payments/upi/loader')
      .then(() => this.upiPaymentLoader.loaderPromise)
      .then(() => this.upiPaymentLoader.init());
  }

  loadPix(): Promise<PixPayment> {
    if (this.pixPaymentLoader) {
      return Promise.resolve(this.pixPaymentLoader.init());
    }

    return import(/* webpackChunkName: "pix-loader" */ '@/plugins/payments/pix/loader')
      .then(() => this.pixPaymentLoader.loaderPromise)
      .then(() => this.pixPaymentLoader.init());
  }

  /** @internal */
  loadOvo(): Promise<OvoPayment> {
    if (this.ovoPaymentLoader) {
      return Promise.resolve(this.ovoPaymentLoader.init());
    }

    return import(/* webpackChunkName: "ovo-loader" */ '@/plugins/payments/ovo/loader')
      .then(() => this.ovoPaymentLoader.loaderPromise)
      .then(() => this.ovoPaymentLoader.init());
  }

  /** @internal */
  loadMercadoPago(): Promise<MercadoPagoPayment> {
    if (this.mercadoPagoPaymentLoader) {
      return Promise.resolve(this.mercadoPagoPaymentLoader.init());
    }

    return import(/* webpackChunkName: "mercado-pago-loader" */ '@/plugins/payments/mercado_pago/loader')
      .then(() => this.mercadoPagoPaymentLoader.loaderPromise)
      .then(() => this.mercadoPagoPaymentLoader.init());
  }

  /** @internal */
  loadNupay(): Promise<NupayPayment> {
    if (this.nupayPaymentLoader) {
      return Promise.resolve(this.nupayPaymentLoader.init());
    }

    return import(/* webpackChunkName: "nupay-loader" */ '@/plugins/payments/nupay/loader')
      .then(() => this.nupayPaymentLoader.loaderPromise)
      .then(() => this.nupayPaymentLoader.init());
  }

  /** @internal */
  loadPicpay(): Promise<PicpayPayment> {
    if (this.picpayPaymentLoader) {
      return Promise.resolve(this.picpayPaymentLoader.init());
    }

    return import(/* webpackChunkName: "picpay-loader" */ '@/plugins/payments/picpay/loader')
      .then(() => this.picpayPaymentLoader.loaderPromise)
      .then(() => this.picpayPaymentLoader.init());
  }

  /** @internal */
  loadThaiQr(): Promise<ThaiQrPayment> {
    if (this.thaiQrPaymentLoader) {
      return Promise.resolve(this.thaiQrPaymentLoader.init());
    }

    return import(/* webpackChunkName: "thai-qr-loader" */ '@/plugins/payments/thai_qr/loader')
      .then(() => this.thaiQrPaymentLoader.loaderPromise)
      .then(() => this.thaiQrPaymentLoader.init());
  }

  /** @internal */
  loadNequi(): Promise<NequiPayment> {
    if (this.nequiPaymentLoader) {
      return Promise.resolve(this.nequiPaymentLoader.init());
    }

    return import(/* webpackChunkName: "nequi-loader" */ '@/plugins/payments/nequi/loader')
      .then(() => this.nequiPaymentLoader.loaderPromise)
      .then(() => this.nequiPaymentLoader.init());
  }

  /** @internal */
  loadDirectDebit(): Promise<DirectDebitPayment> {
    if (this.directDebitPaymentLoader) return Promise.resolve(this.directDebitPaymentLoader.init());

    return import(/* webpackChunkName: "direct-debit-loader" */ '@/plugins/payments/direct_debit/loader')
      .then(() => this.directDebitPaymentLoader.loaderPromise)
      .then(() => this.directDebitPaymentLoader.init());
  }

  /** @internal */
  loadFasterPayments(): Promise<FasterPymtsPayment> {
    if (this.fasterPymtsPaymentLoader) return Promise.resolve(this.fasterPymtsPaymentLoader.init());

    return import(/* webpackChunkName: "faster-payments-loader" */ '@/plugins/payments/faster_payments/loader')
      .then(() => this.fasterPymtsPaymentLoader.loaderPromise)
      .then(() => this.fasterPymtsPaymentLoader.init());
  }

  /** @internal */
  loadPayTo(): Promise<PayToPayment> {
    if (this.payToPaymentLoader) return Promise.resolve(this.payToPaymentLoader.init());

    return import(/* webpackChunkName: "pay-to-loader" */ '@/plugins/payments/pay_to/loader')
      .then(() => this.payToPaymentLoader.loaderPromise)
      .then(() => this.payToPaymentLoader.init());
  }

  /** @internal */
  loadSepaInstantTransfer(): Promise<SepaInstantTransferPayment> {
    if (this.sepaInstantTransferPaymentLoader) return Promise.resolve(this.sepaInstantTransferPaymentLoader.init());

    return import(
      /* webpackChunkName: "sepa-instant-transfer-loader" */ '@/plugins/payments/sepa_instant_transfer/loader'
    )
      .then(() => this.sepaInstantTransferPaymentLoader.loaderPromise)
      .then(() => this.sepaInstantTransferPaymentLoader.init());
  }

  /** @internal */
  loadBoleto(): Promise<BoletoPayment> {
    if (this.boletoPaymentLoader) return Promise.resolve(this.boletoPaymentLoader.init());

    return import(/* webpackChunkName: "boleto-loader" */ '@/plugins/payments/boleto/loader')
      .then(() => this.boletoPaymentLoader.loaderPromise)
      .then(() => this.boletoPaymentLoader.init());
  }

  /** @internal */
  loadKlarnaPayNow(): Promise<KlarnaPayNowPayment> {
    if (this.klarnaPayNowLoader) return Promise.resolve(this.klarnaPayNowLoader.init());
    return import(/* webpackChunkName: "klarna-pay-now-loader" */ '@/plugins/payments/klarna_pay_now/loader')
      .then(() => this.klarnaPayNowLoader.loaderPromise)
      .then(() => this.klarnaPayNowLoader.init());
  }

  /** @internal */
  loadKlarna(): Promise<KlarnaPayment> {
    if (this.klarnaPaymentLoader) return Promise.resolve(this.klarnaPaymentLoader.init());
    return import(/* webpackChunkName: "klarna-loader" */ '@/plugins/payments/klarna/loader')
      .then(() => this.klarnaPaymentLoader.loaderPromise)
      .then(() => this.klarnaPaymentLoader.init());
  }

  /** @internal */
  loadOnlineBankingPoland(): Promise<OnlineBankingPolandPayment> {
    if (this.onlineBankingPolandPaymentLoader) {
      return Promise.resolve(this.onlineBankingPolandPaymentLoader.init());
    }

    return import(
      /* webpackChunkName: "online-banking-poland-loader" */ '@/plugins/payments/online_banking_poland/loader'
    )
      .then(() => this.onlineBankingPolandPaymentLoader.loaderPromise)
      .then(() => this.onlineBankingPolandPaymentLoader.init());
  }

  /** @internal */
  loadPayconiqByBancontact(): Promise<PayconiqByBancontactPayment> {
    if (this.payconiqByBancontactPaymentLoader) {
      return Promise.resolve(this.payconiqByBancontactPaymentLoader.init());
    }

    return import(
      /* webpackChunkName: "payconiq-by-bancontact-loader" */ '@/plugins/payments/payconiq_by_bancontact/loader'
    )
      .then(() => this.payconiqByBancontactPaymentLoader.loaderPromise)
      .then(() => this.payconiqByBancontactPaymentLoader.init());
  }

  /** @internal */
  loadTwint(): Promise<TwintPayment> {
    if (this.twintPaymentLoader) {
      return Promise.resolve(this.twintPaymentLoader.init());
    }

    return import(/* webpackChunkName: "twint-loader" */ '@/plugins/payments/twint/loader')
      .then(() => this.twintPaymentLoader.loaderPromise)
      .then(() => this.twintPaymentLoader.init());
  }

  /** @internal */
  loadGoPay(): Promise<GoPayPayment> {
    if (this.goPayPaymentLoader) {
      return Promise.resolve(this.goPayPaymentLoader.init());
    }

    return import(/* webpackChunkName: "go-pay-loader" */ '@/plugins/payments/go_pay/loader')
      .then(() => this.goPayPaymentLoader.loaderPromise)
      .then(() => this.goPayPaymentLoader.init());
  }

  /** @internal */
  loadGrabPay(): Promise<GrabPayPayment> {
    if (this.grabPayPaymentLoader) {
      return Promise.resolve(this.grabPayPaymentLoader.init());
    }

    return import(/* webpackChunkName: "grab-pay-loader" */ '@/plugins/payments/grab_pay/loader')
      .then(() => this.grabPayPaymentLoader.loaderPromise)
      .then(() => this.grabPayPaymentLoader.init());
  }

  /** @internal */
  loadKbcPaymentButton(): Promise<KbcPaymentButtonPayment> {
    if (this.kbcPaymentButtonPaymentLoader) {
      return Promise.resolve(this.kbcPaymentButtonPaymentLoader.init());
    }

    return import(/* webpackChunkName: "kbc-payment-button-loader" */ '@/plugins/payments/kbc_payment_button/loader')
      .then(() => this.kbcPaymentButtonPaymentLoader.loaderPromise)
      .then(() => this.kbcPaymentButtonPaymentLoader.init());
  }

  /** @internal */
  loadElectronicPaymentStandard(): Promise<ElectronicPaymentStandardPayment> {
    if (this.electronicPaymentStandardPaymentLoader) {
      return Promise.resolve(this.electronicPaymentStandardPaymentLoader.init());
    }

    return import(
      /* webpackChunkName: "electronic-payment-standard-loader" */ '@/plugins/payments/electronic_payment_standard/loader'
    )
      .then(() => this.electronicPaymentStandardPaymentLoader.loaderPromise)
      .then(() => this.electronicPaymentStandardPaymentLoader.init());
  }

  loadKakaoPay(): Promise<KakaoPayPayment> {
    if (this.kakaoPayPaymentLoader) return Promise.resolve(this.kakaoPayPaymentLoader.init());
    return import(/* webpackChunkName: "kakao-pay-loader" */ '@/plugins/payments/kakao_pay/loader')
      .then(() => this.kakaoPayPaymentLoader.loaderPromise)
      .then(() => this.kakaoPayPaymentLoader.init());
  }

  /** @internal */
  loadNaverPay(): Promise<NaverPayPayment> {
    if (this.naverPayPaymentLoader) return Promise.resolve(this.naverPayPaymentLoader.init());
    return import(/* webpackChunkName: "naver-pay-loader" */ '@/plugins/payments/naver_pay/loader')
      .then(() => this.naverPayPaymentLoader.loaderPromise)
      .then(() => this.naverPayPaymentLoader.init());
  }

  /** @internal */
  loadWechatPay(): Promise<WechatPayPayment> {
    if (this.wechatPayPaymentLoader) return Promise.resolve(this.wechatPayPaymentLoader.init());
    return import(/* webpackChunkName: "wechat-pay-loader" */ '@/plugins/payments/wechat_pay/loader')
      .then(() => this.wechatPayPaymentLoader.loaderPromise)
      .then(() => this.wechatPayPaymentLoader.init());
  }

  /** @internal */
  loadPayme(): Promise<PaymePayment> {
    if (this.paymePaymentLoader) return Promise.resolve(this.paymePaymentLoader.init());
    return import(/* webpackChunkName: "payme-loader" */ '@/plugins/payments/payme/loader')
      .then(() => this.paymePaymentLoader.loaderPromise)
      .then(() => this.paymePaymentLoader.init());
  }

  /** @internal */
  loadSwishPay(): Promise<SwishPayment> {
    if (this.swishPaymentLoader) return Promise.resolve(this.swishPaymentLoader.init());
    return import(/* webpackChunkName: "swish-loader" */ '@/plugins/payments/swish/loader')
      .then(() => this.swishPaymentLoader.loaderPromise)
      .then(() => this.swishPaymentLoader.init());
  }

  /** @internal */
  loadBizum(): Promise<BizumPayment> {
    if (this.bizumPaymentLoader) return Promise.resolve(this.bizumPaymentLoader.init());
    return import(/* webpackChunkName: "bizum-loader" */ '@/plugins/payments/bizum/loader')
      .then(() => this.bizumPaymentLoader.loaderPromise)
      .then(() => this.bizumPaymentLoader.init());
  }

  /** @internal */
  loadPayNow(): Promise<PayNowPayment> {
    if (this.paynowPaymentLoader) return Promise.resolve(this.paynowPaymentLoader.init());
    return import(/* webpackChunkName: "paynow-loader" */ '@/plugins/payments/paynow/loader')
      .then(() => this.paynowPaymentLoader.loaderPromise)
      .then(() => this.paynowPaymentLoader.init());
  }

  /** @internal */
  loadPromptPay(): Promise<PromptPayPayment> {
    if (this.promptpayPaymentLoader) return Promise.resolve(this.promptpayPaymentLoader.init());
    return import(/* webpackChunkName: "promptpay-loader" */ '@/plugins/payments/promptpay/loader')
      .then(() => this.promptpayPaymentLoader.loaderPromise)
      .then(() => this.promptpayPaymentLoader.init());
  }

  /** @internal */
  loadCashAppPay(): Promise<CashAppPayPayment> {
    if (this.cashAppPayPaymentLoader) return Promise.resolve(this.cashAppPayPaymentLoader.init());
    return import(/* webpackChunkName: "cash-app-pay-loader" */ '@/plugins/payments/cash_app_pay/loader')
      .then(() => this.cashAppPayPaymentLoader.loaderPromise)
      .then(() => this.cashAppPayPaymentLoader.init());
  }

  /** @internal */
  loadRevolutPay(): Promise<RevolutPayPayment> {
    if (this.revolutPayPaymentLoader) return Promise.resolve(this.revolutPayPaymentLoader.init());
    return import(/* webpackChunkName: "revolut-pay-loader" */ '@/plugins/payments/revolut_pay/loader')
      .then(() => this.revolutPayPaymentLoader.loaderPromise)
      .then(() => this.revolutPayPaymentLoader.init());
  }

  /** @internal */
  loadDana(): Promise<DanaPayment> {
    if (this.danaPaymentLoader) return Promise.resolve(this.danaPaymentLoader.init());
    return import(/* webpackChunkName: "dana-loader" */ '@/plugins/payments/dana/loader')
      .then(() => this.danaPaymentLoader.loaderPromise)
      .then(() => this.danaPaymentLoader.init());
  }

  /** @internal */
  loadTouchNGo(): Promise<TouchNGoPayment> {
    if (this.touchNGoPaymentLoader) return Promise.resolve(this.touchNGoPaymentLoader.init());
    return import(/* webpackChunkName: "touch-n-go-loader" */ '@/plugins/payments/touch_n_go/loader')
      .then(() => this.touchNGoPaymentLoader.loaderPromise)
      .then(() => this.touchNGoPaymentLoader.init());
  }

  /** @internal */
  loadTamara(): Promise<TamaraPayment> {
    if (this.tamaraPaymentLoader) return Promise.resolve(this.tamaraPaymentLoader.init());
    return import(/* webpackChunkName: "tamara-loader" */ '@/plugins/payments/tamara/loader')
      .then(() => this.tamaraPaymentLoader.loaderPromise)
      .then(() => this.tamaraPaymentLoader.init());
  }

  /** @internal */
  loadQpay(): Promise<QpayPayment> {
    if (this.qpayPaymentLoader) return Promise.resolve(this.qpayPaymentLoader.init());
    return import(/* webpackChunkName: "qpay-loader" */ '@/plugins/payments/qpay/loader')
      .then(() => this.qpayPaymentLoader.loaderPromise)
      .then(() => this.qpayPaymentLoader.init());
  }

  /** @internal */
  loadpaypay(): Promise<PaypayPayment> {
    if (this.PaypayPaymentLoader) return Promise.resolve(this.PaypayPaymentLoader.init());
    return import(/* webpackChunkName: "paypay-loader" */ '@/plugins/payments/paypay/loader')
      .then(() => this.PaypayPaymentLoader.loaderPromise)
      .then(() => this.PaypayPaymentLoader.init());
  }

  /** @internal */
  loadSouthKoreanCards(): Promise<SouthKoreanCardsPayment> {
    if (this.SouthKoreanCardsPaymentLoader) return Promise.resolve(this.SouthKoreanCardsPaymentLoader.init());
    return import(/* webpackChunkName: "south-korean-cards-loader" */ '@/plugins/payments/south_korean_cards/loader')
      .then(() => this.SouthKoreanCardsPaymentLoader.loaderPromise)
      .then(() => this.SouthKoreanCardsPaymentLoader.init());
  }

  loadPayCo(): Promise<PayCoPayment> {
    if (this.payCoPaymentLoader) {
      return Promise.resolve(this.payCoPaymentLoader.init());
    }

    return import(/* webpackChunkName: "pay-co-loader" */ '@/plugins/payments/pay_co/loader')
      .then(() => this.payCoPaymentLoader.loaderPromise)
      .then(() => this.payCoPaymentLoader.init());
  }

  /** @internal */
  private loadComponentsModule() {
    if (this.componentLoader) return Promise.resolve(true);

    return import(/* webpackChunkName: "components-fields-loader" */ '@/plugins/components_fields/loader').then(
      (ComponentsAndFieldsLoader) => {
        if (!this.componentLoader) {
          this.componentLoader = new ComponentsAndFieldsLoader.default();
        }
        return this.componentLoader.loaderPromise;
      }
    );
  }

  /** @internal */
  private loadHostedPagePlugin() {
    if (this.hostedPagePlugin) {
      return Promise.resolve(true);
    }
    return import(/* webpackChunkName: "hosted-page-loader" */ '@/plugins/hosted_page/host/impl').then(() => {
      return this.hostedPagePlugin;
    });
  }

  /** @internal */
  // Set referrerModule (for tracking)
  setReferrerModule(referrerModule: string) {
    if (typeof referrerModule == 'string' && referrerModule.trim()) {
      this.options.referrerModule = referrerModule;
    }
  }

  setPortalSession(ssoToken: (() => Promise<PortalSession>) | string): void {
    if (typeof ssoToken === 'function') {
      this.authHandler.setSsoTokenFetcher(ssoToken);
    } else {
      this.authHandler.setSsoToken(ssoToken);
    }
  }

  openCheckout(options: OpenCheckoutOptions): void {
    if (options.hostedPage || options.hostedPageUrl || options.url) {
      Helpers.resetFlags();
      var page = new Page(PageType.CHECKOUT, options);
      Handler.submit(page);
    } else {
      this.cart.proceedToCheckout();
    }
  }

  createCheckout(options: CheckoutOptions): Promise<Checkout> {
    return this.loadHostedPagePlugin().then(() => {
      return this.hostedPagePlugin.loadCheckout(options);
    });
  }

  createChargebeePortal(): ChargebeePortal {
    return new ChargebeePortal(this);
  }

  /** @internal */
  needsSsoAuthentication(pageType: PageType): boolean {
    return pageType == PageType.PORTAL ? !!this.authHandler.ssoToken || !!this.authHandler.ssoTokenFetcher : false;
  }

  logout(): void {
    this.authHandler.logout();
  }

  closeAll(): void {
    Handler.reset();
  }

  setLocale(locale: Locale) {
    this.options.locale = locale;
    // loadTranslations(this.options.locale);
  }

  /** @internal */
  getSiteInfo(): Promise<JsInfo> {
    return Handler.getJSInfo();
  }

  /**
   * Ensures /retrieve_js_info has been applied (style + pcConfigurationVersion).
   * Safe to call multiple times; shares the same loadStyle promise.
   * @internal
   */
  ensureSiteInfo(): Promise<JsInfo> {
    return Handler.loadStyle();
  }

  /** @internal */
  setStyle(style: JsInfo) {
    if (style) {
      this.styleConfig.image = style.image && style.image.url;
      this.styleConfig.color = style.color;
      this.styleConfig.layout = style.default_hp_layout;
      this.options.pcConfigurationVersion = style.pc_configuration_version;
    }
  }

  getCart() {
    return this.cart;
  }

  initializeProduct(planId: string, planQuantity?: number): Product {
    return new Product(planId, planQuantity, this.isItemsModel);
  }

  getProduct(element: CbAnchorElement): Product {
    return element.cbProduct;
  }

  setPortalCallbacks(callbacks: SetPortalCallbacks): void {
    this.portalCallbacks = callbacks;
  }

  setCheckoutCallbacks(callbacks: (cart: Cart) => CbCheckoutCallbacks): void {
    this.checkoutCallbacks = callbacks;
  }

  createComponent(componentType: ComponentTypeRaw = ComponentType.Card, options: ComponentOptions = {}): Component {
    Assert.notTrue(() => this.componentLoader != null, 'modules not loaded');
    return this.componentLoader.createComponent(componentType as ComponentType, options);
  }

  tokenize(component: Component | ComponentType.Bank, payload = {}): Promise<any> {
    return this.componentLoader.tokenize(component, payload);
  }

  authorizeWith3ds(
    component: Component,
    intent: PaymentIntent,
    additionalData: AdditionalData,
    callbacks: Callbacks
  ): Promise<PaymentIntent> {
    return this.componentLoader.authorizeWith3ds(component, intent, additionalData, callbacks);
  }

  create3DSHandler(): ThreeDSHandler {
    if (this.threeDSLoader) return this.threeDSLoader.init();

    Assert.notTrue(() => this.threeDSLoader != null, 'module not loaded');
    return this.threeDSLoader.init();
  }

  /** @internal */
  loadComponent(componentType: ComponentType, options = {}): Promise<Component> {
    return this.loadComponentsModule().then(() => {
      return this.componentLoader.createComponent(componentType, options);
    });
  }

  /** @internal */
  initializeCaptcha(options: RecaptchaOptions) {
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: Master.Actions.InitializeCaptcha,
          data: {
            siteKey: options.siteKey,
            provider: options.provider,

            // Added for Backwards compatibility
            isGlobalRecaptcha: options.isGlobalRecaptcha,
            hideBanner: options.hideBanner,
          },
        },
        Ids.MASTER_FRAME,
        {timeout: 120000}
      )
    );
  }

  /** @internal */
  initializeRecaptcha(siteKey: string, isGlobalRecaptcha: boolean, hideBanner: boolean): Promise<any> {
    return this.initializeCaptcha({
      siteKey,
      isGlobalRecaptcha,
      hideBanner,
      provider: CaptchaProviderName.GOOGLE_RECAPTCHA,
    });
  }

  /** @internal */
  validateRecaptcha(action: string): Promise<any> {
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: Master.Actions.GenerateCaptchaToken,
          data: {
            action,
          },
        },
        Ids.MASTER_FRAME,
        {timeout: 120000}
      )
    );
  }

  /** @internal */
  skipPopup(paymentType: string, options: PaymentOptions) {
    if (paymentType == 'payconiq_by_bancontact' && !(options.paymentInfo && options.paymentInfo.useGateway)) {
      return true;
    }
    return paymentType == 'pay_to' && !(options.paymentInfo && options.paymentInfo.useGateway);
  }

  handlePayment(paymentType: string, options: PaymentOptions): Promise<any> {
    let windowManager;
    let popupTask: Promise<any> = Promise.resolve();
    if (
      paymentType in TabRedirectPayments &&
      !options.redirectMode &&
      !options.iframeMode &&
      !this.skipPopup(paymentType, options)
    ) {
      /**
       * Browsers will block new tabs/ windows which are not opened on user action
       * As a workaround, a blank tab is opened first and after fetching the URL from server
       * it is loaded in the blank tab
       *
       * The tab is still blocked when the user action has already expired, for instance when
       * handlePayment is called after awaiting a payment intent. openDirectWithConsent then
       * collects a fresh click through an overlay, if the merchant opted in to it.
       */
      windowManager = new CbWindowManager();
      const windowManagerOptions = {
        skipReferrer: true,
        showLoader: true,
        openInNewWindow: true,
        enablePopupConsentOverlay:
          typeof options.enablePopupConsentOverlay === 'boolean'
            ? options.enablePopupConsentOverlay
            : this.options.enablePopupConsentOverlay,
        popupConsentOverlay:
          options.popupConsentOverlay != undefined ? options.popupConsentOverlay : this.options.popupConsentOverlay,
      };
      window.CbLogger.info('CbWindowManager', 'openDirectWithConsent', JSON.stringify(windowManagerOptions), true);
      popupTask = windowManager.openDirectWithConsent('', PAYMENT_AUTH_REDIRECT_WINDOW_NAME, windowManagerOptions);
    }
    return popupTask.then((result) => {
      window.CbLogger.info('CbInstance', 'invoke:handlePayment:popupTask:result', result, true);
      return this.dispatchPayment(paymentType, options, windowManager);
    });
  }

  private dispatchPayment(paymentType: string, options: PaymentOptions, windowManager?: CbWindowManager): Promise<any> {
    switch (paymentType) {
      case 'ideal':
      case 'sofort':
      case 'giropay':
      case 'dotpay':
      case 'bancontact':
      case 'netbanking_emandates':
      case 'pix':
      case 'direct_debit':
      case 'boleto':
      case 'faster_payments':
      case 'pay_to':
      case 'sepa_instant_transfer':
      case 'klarna_pay_now':
      case 'klarna':
      case 'online_banking_poland':
      case 'payconiq_by_bancontact':
      case 'stablecoin':
      case 'amazon_pay':
      case 'pay_by_bank':
      case 'trustly':
      case 'kbc_payment_button':
      case 'electronic_payment_standard':
      case 'kakao_pay':
      case 'naver_pay':
      case 'revolut_pay':
      case 'cash_app_pay':
      case 'wechat_pay':
      case 'pay_co':
      case 'grab_pay':
      case 'go_pay':
      case 'twint':
      case 'alipay':
      case 'paypay':
      case 'south_korean_cards':
      case 'swish':
      case 'payme':
      case 'alipay_hk':
      case 'dana':
      case 'gcash':
      case 'touch_n_go':
      case 'tamara':
      case 'qpay':
      case 'bizum':
      case 'ovo':
      case 'mercado_pago':
      case 'nupay':
      case 'picpay':
      case 'thai_qr':
      case 'nequi':
      case 'paynow':
      case 'promptpay':
      case 'momo':
      case 'rakuten_pay':
        return this.load(paymentType).then((module) => {
          if (options.redirectMode) {
            module.setRedirectMode(true);
          } else {
            module.setWindowManager(windowManager);
          }
          /**
           * providing backward compatibility to bancontact handler
           * which expects arguments in different order
           */
          if (['netbanking_emandates'].includes(paymentType)) {
            return module.handlePayment(options.paymentInfo, options.callbacks);
          }
          /**
           * Support callback flow for online banking poland
           * https://www.chargebee.com/checkout-portal-docs/online-banking-poland-tutorial.html
           *
           */
          if (['online_banking_poland'].includes(paymentType)) {
            if (options.paymentInfo && options.callbacks) {
              return module.handlePayment(options.paymentInfo, options.callbacks);
            }
          }
          return module.handlePayment(options);
        });
      default:
        return Promise.reject(new Error('unsupported_payment_type'));
    }
  }

  /** @internal */
  setHpToken(cbHpToken) {
    this.hp_token = cbHpToken;
  }

  /** @internal */
  getHpToken() {
    return this.hp_token;
  }

  private async loadScript(url: string) {
    return new Promise((res) => {
      const script = document.createElement('script');
      script.src = url;
      script.onload = res;
      document.head.appendChild(script);
    });
  }

  async cancelPage(): Promise<CancelPage> {
    window.CbLogger.info('CbInstance', 'invoke:CancelPage', 'opening CancelPage from chargebee instance', true);
    if (this.retentionLoad === undefined) {
      this.retentionLoad = this.loadScript(EnvConstants.RETENTION_JS);
    }

    await this.retentionLoad;

    const options = {
      businessEntityId: undefined,
      siteId: undefined,
    };

    const businessEntityId = this.cart.businessEntityId;
    if (businessEntityId) {
      options.businessEntityId = businessEntityId;
    }

    const siteId = this.site;
    if (siteId) {
      options.siteId = siteId;
    }

    return new window.ChurnDeflection(options);
  }

  async pricingTable(): Promise<PricingTable> {
    window.CbLogger.info('CbInstance', 'invoke:pricingTable', 'opening pricingTable from chargebee instance', true);
    if (this.atomicPricingLoad === undefined) {
      this.atomicPricingLoad = this.loadScript(EnvConstants.PRICING_TABLE_JS);
    }

    await this.atomicPricingLoad;

    const businessEntityId = this.cart.businessEntityId;
    if (businessEntityId) {
      window.Pricify.setBusinessEntity(businessEntityId);
    }

    return window.Pricify;
  }

  async personalizedOffers(): Promise<PersonalizedOffers> {
    window.CbLogger.info(
      'CbInstance',
      'invoke:personalizedOffers',
      'opening personalizedOffers from chargebee instance',
      true
    );
    if (this.retentionLoad === undefined) {
      this.retentionLoad = this.loadScript(EnvConstants.RETENTION_JS);
    }

    await this.retentionLoad;

    const options = {
      businessEntityId: undefined,
      siteId: undefined,
    };

    const businessEntityId = this.cart.businessEntityId;
    if (businessEntityId) {
      options.businessEntityId = businessEntityId;
    }

    const siteId = this.site;
    if (siteId) {
      options.siteId = siteId;
    }

    return new window.PersonalizedOffers(options);
  }
}
