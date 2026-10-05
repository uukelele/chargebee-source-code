import {Layout, PageType} from '@/constants/enums';
import LogKeys from '@/constants/log-keys';
import Urls from '@/models/urls';
import Ids from '@/constants/ids';
import Page from '@/models/page';
import {AFTER_URL_FETCH, ERROR} from '@/constants/callbacks';
import Helpers from '@/helpers/index';
import Manager, {ManagerType} from '@/interfaces/cb-manager';
import CbIframeManager from '@/models/cb-iframe-manager';
import CbWindowManager from '@/models/cb-window-manager';
import {isMobileSafari} from '@/utils/utility-functions';
import {StyleConfig, HostedPageData} from '@/interfaces/cb-types';
import {State} from '@/constants/enums';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import {Master} from '@/hosted_fields/common/enums';
import {Info as JsInfo} from '@/plugins/checkout_utils/types';
import Errors from '@/hosted_fields/common/errors';

// TODO Think whether we can make this as singleton?
export default class Handler {
  static isBusy: boolean;

  static manager: Manager;

  static page: Page;

  static queued: boolean;

  /** Shared promise for /retrieve_js_info → setStyle (pcConfigurationVersion, layout, etc.). */
  static styleLoaded: Promise<any> | null = null;

  static init({iframeOnly = false, enableRedirectMode = false} = {}) {
    this.isBusy = false;
    const windowManager = (options?) => new CbWindowManager(options);
    const iframeManager = () => new CbIframeManager();

    if (iframeOnly) {
      this.manager = iframeManager();
    } else if (enableRedirectMode) {
      this.manager = windowManager({redirectMode: true});
    } else {
      this.manager = !Helpers.isMobileOrTablet() ? iframeManager() : windowManager();
    }
    this.manager.init();
    this.loadStyle().then(() => {
      this.manager.setLayout(Helpers.getLayout());
      // TODO: Add logic here to change manager type depending on layout
    });
  }

  static showPage() {
    this.page.timeLogs[LogKeys.AFTER_LOAD] = Date.now();
    this.manager.show();
    Helpers.sendLog(this.page);
  }

  static getJSInfo(): Promise<JsInfo> {
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: Master.Actions.LoadJsInfo,
        },
        Ids.MASTER_FRAME,
        {timeout: 300000}
      )
    ) // 5 minutes timeout
      .then((info: JsInfo) => info);
  }

  static loadStyle() {
    if (!Handler.styleLoaded) {
      Handler.styleLoaded = Handler.getJSInfo().then((info: JsInfo) => {
        Helpers.getCbInstance().setStyle(info);
        return info;
      });
    }
    return Handler.styleLoaded;
  }

  static submit(page: Page) {
    if (page && page.layout) {
      this.manager.setLayout(page.layout);
    }
    if (page && page.type == PageType.PORTAL) {
      this.manager.setLayout(Layout.IN_APP);
    }
    this.manager.setTitle(page ? page.title : undefined);
    if (this.manager.type == ManagerType.WINDOW_MANAGER) {
      let windowManager = <CbWindowManager>this.manager;
      if (windowManager.window && windowManager.window.closed) {
        this.reset();
      }
    }
    if (this.isBusy) {
      if (isMobileSafari()) {
        this.reset();
      } else {
        page.callbacks['error'] && page.callbacks['error']('Already another checkout is in progress');
      }
    }
    this._submit(page);
    this.process();
  }

  static process() {
    // TODO Hotfix. Needs to be refactored
    if (this.page.type == PageType.CHECKOUT && this.manager.type == ManagerType.WINDOW_MANAGER && this.page.url) {
      let windowManager = <CbWindowManager>this.manager;
      windowManager.openDirect(this.page.url, 'Checkout Page');
    } else {
      this.manager.showLoader();
      this._process();
    }
    this.queued = false;
  }

  static reset() {
    this.manager.close();
    this.page = undefined;
    this.isBusy = false;
  }

  private static _submit(page: Page) {
    this.page = page;
    this.manager.setCallBacks(this.page.callbacks);
    this.isBusy = true;
  }

  private static _process() {
    if (this.page.type == PageType.CHECKOUT) {
      this._processCheckout();
    } else {
      this._processPortal();
    }
  }

  private static _processCheckout() {
    if (this.page.urlFetcher) {
      this.page.timeLogs[LogKeys.BEFORE_SEND] = Date.now();
      let finalPromise = this.page.urlFetcher();

      const cbInstance = Helpers.getCbInstance();
      const site = cbInstance.site;
      if (finalPromise && !Helpers.isPromise(finalPromise) && Helpers.isTestSite(site)) {
        const error = new Error(
          "The 'hostedPage' function should return a promise resolving to a hosted page object. Ref: https://www.chargebee.com/checkout-portal-docs/api-checkout.html#opening-chargebee-checkout"
        );
        console.error(error);
      }
      const handlePromise = finalPromise.then((data: HostedPageData) => {
        this.page.callbacks[AFTER_URL_FETCH] && this.page.callbacks[AFTER_URL_FETCH](data);
        this.page.timeLogs[LogKeys.AFTER_URL_FETCH] = Date.now();
        if (data) {
          this.page.url = data.url;
          this.manager.open(data.url, 'Checkout Page');
        } else {
          this.manager.close();
        }
      });

      if (finalPromise.catch) {
        if (handlePromise != undefined && handlePromise.catch) {
          handlePromise.catch((error) => {
            this.manager.close();
            this.page.callbacks[ERROR] && this.page.callbacks[ERROR](error);
          });
        } else {
          finalPromise.catch((error) => {
            this.manager.close();
            this.page.callbacks[ERROR] && this.page.callbacks[ERROR](error);
          });
        }
      }
    } else if (this.page.url) {
      this.manager.open(this.page.url, 'Checkout Page');
    }
  }

  private static _processPortal() {
    let cbInstance = Helpers.getCbInstance();
    this.page.timeLogs[LogKeys.BEFORE_SEND] = Date.now();
    if (cbInstance.needsSsoAuthentication(this.page.type) && !cbInstance.authenticated) {
      this._wrapSso(this.page.name, this.page.options);
    } else {
      let url;
      if (this.page.name == 'home') {
        url = Urls['portal_home'](this.page.options);
      } else {
        url = Urls['portal_default'](Object.assign({forward: this.page.name}, this.page.options));
      }
      this.manager.open(url, 'Billing Portal');
    }
  }

  // forward is not actually forward. It is the individual page which needs to be opened
  private static _wrapSso(forward: string, options: {}) {
    let queryFormatter = (token) => {
      return Object.assign({token: token, forward: forward}, options);
    };
    let cbInstance = Helpers.getCbInstance();
    cbInstance.authHandler.state = State.AUTH_INTITIATED;
    var that = this;
    if (cbInstance.authHandler.ssoTokenFetcher) {
      let finalPromise = cbInstance.authHandler.ssoTokenFetcher().then(function (portal_session) {
        that.page.timeLogs[LogKeys.AFTER_SSO] = Date.now();
        that.manager.open(Urls.authentication(queryFormatter(portal_session.token)), 'Billing Portal');
      });
      if (finalPromise.catch) {
        finalPromise.catch(function (error) {
          that.manager.close();
          that.page.callbacks[ERROR] && that.page.callbacks[ERROR](error);
        });
      }
    } else if (cbInstance.authHandler.ssoToken) {
      if (typeof cbInstance.authHandler.ssoToken == 'object') {
        that.manager.open(Urls.authentication(queryFormatter(cbInstance.authHandler.ssoToken.token)), 'Billing Portal');
      } else {
        that.manager.open(Urls.authentication(queryFormatter(cbInstance.authHandler.ssoToken)), 'Billing Portal');
      }
    }
  }
}
