import Manager, {ManagerType} from '@/interfaces/cb-manager';
import Urls from '@/models/urls';
import Helpers from '@/helpers/index';
import {CLOSE} from '@/constants/callbacks';
import {CbCallbacksInterface} from '@/interfaces/cb-types';
import {TitleOption, Layout, PageCategory} from '@/constants/enums';
import Logger from '@/utils/logger_old';
import {isWindowsOS, isSafariMacOS, isMobileSafari, hasTransientUserActivation} from '@/utils/utility-functions';
import EnvConstants from '@/constants/environment';
import PopupConsentOverlay from '@/internal/auth-redirect/popup-consent-overlay';
import ErrorCodes, {CbError} from '@/hosted_fields/common/errors';
import {PopupConsentOverlayOptions} from '@/interfaces/cb-instance-options';

export interface WindowOpenOptions {
  skipReferrer?: boolean;
  showLoader?: boolean;
  openInNewWindow?: boolean;
  closeCallback?: () => void;
  enablePopupConsentOverlay?: boolean;
  popupConsentOverlay?: PopupConsentOverlayOptions;
}

export default class CbWindowManager implements Manager {
  type: ManagerType;
  window: Window;
  windowOpened: boolean;
  redirectMode: boolean;
  layout: Layout;
  title?: TitleOption;

  constructor({redirectMode = false} = {}) {
    this.redirectMode = redirectMode;
  }

  init(): void {
    this.type = ManagerType.WINDOW_MANAGER;
  }

  setLayout(layout: Layout) {
    this.layout = layout;
  }

  setTitle(title?: TitleOption) {
    this.title = title;
  }

  showLoader(): void {
    if (this.window && !this.window.closed) {
      this.window.close();
    }
    // can be null if opened in salesforce environment
    // @ts-ignore
    const windowTarget = isMobileSafari() ? '_blank' : 'cb-pages';
    this.window = this.redirectMode ? window.top : window.open(this.getLoaderUrl(), windowTarget);
    this.windowOpened = false;
  }

  loadURL(url: string): void {
    if (this.window) {
      this.window.location.replace(url);
    }
  }

  openDirect(url, type, options?: WindowOpenOptions): void {
    if (this.window && !this.window.closed) {
      this.window.close();
    }
    let _url = url;
    if (!(options && options.skipReferrer)) {
      // TODO refactor this after checking the hot fix
      let referrer = Helpers.getReferrer();
      let businessEntityId = Helpers.getBusinessEntityId();
      let brandId = Helpers.getBrandId();

      try {
        let srcUrl: any;
        srcUrl = new URL(url);
        srcUrl.searchParams.append('hp_opener', this.redirectMode ? 'chargebee_redirect' : 'chargebee');
        srcUrl.searchParams.append('hp_referrer', referrer);
        this.layout && srcUrl.searchParams.append('layout', this.layout);
        type == PageCategory.PORTAL_PAGE && businessEntityId && srcUrl.searchParams.append('be_id', businessEntityId);
        type == PageCategory.PORTAL_PAGE && brandId && srcUrl.searchParams.append('brand_id', brandId);
        const hpTitle = Helpers.getTitleOptions(this.title);
        hpTitle && srcUrl.searchParams.append('hp_title', hpTitle);
        _url = srcUrl.href;
      } catch (err) {
        Logger.error(err);
        let separator = url.indexOf('?') !== -1 ? (url[url.length - 1] == '&' ? '' : '&') : '?';
        let srcUrl: string = `${url}${separator}hp_opener=${
          this.redirectMode ? 'chargebee_redirect' : 'chargebee'
        }&hp_referrer=${referrer}${
          type == PageCategory.PORTAL_PAGE
            ? Helpers.getBeIdQueryParamForPortal() + Helpers.getBrIdQueryParamForPortal()
            : ''
        }`;
        if (typeof this.layout !== 'undefined') {
          srcUrl += `&layout=${this.layout}`;
        }
        srcUrl += Helpers.getTitleQueryParamForHostedPage(this.title);
        _url = srcUrl;
      }
    }

    // https://mychargebee.atlassian.net/browse/CHKOUTENGG-39198 windows fullscreen fix
    let windowFeatures = '';
    if (options && options.openInNewWindow && !isWindowsOS() && !isSafariMacOS()) {
      windowFeatures = `toolbar=no, location=yes, status=no, menubar=no, scrollbars=yes, resizable=yes`;
    }

    this.window = this.redirectMode ? window.top : window.open(_url, type, windowFeatures);

    if (this.isBlocked()) {
      this.windowOpened = false;
      return;
    }
    if (this.redirectMode) {
      this.window.location.href = _url;
    }
    if (url === '' && options && options.showLoader) {
      // @ts-ignore
      this.window.location.href = this.getLoaderUrl().href;
    }
    if (options && options.closeCallback) {
      this.watchClose(options.closeCallback);
    }
    this.windowOpened = true;
  }

  /**
   * `window.open` returns null when the browser blocks the popup. Some blockers instead hand
   * back a window that is already closed, and a few throw on property access.
   */
  isBlocked(): boolean {
    try {
      return !this.window || this.window.closed || typeof this.window.closed === 'undefined';
    } catch (e) {
      return true;
    }
  }

  /**
   * Opens the window, and if the browser blocked it, renders an overlay so the customer can
   * open it with a fresh click. Resolves once a window is open, rejects with a CbError when
   * the customer dismisses the overlay or the retry is blocked too.
   *
   * `openDirect` runs synchronously here — both on the first attempt and inside the overlay's
   * click listener — because a deferred call loses the user gesture and gets blocked again.
   */
  openDirectWithConsent(url: string, type: string, options?: WindowOpenOptions): Promise<string> {
    if (!this.consentOverlayEnabled(options) || this.redirectMode) {
      this.openDirect(url, type, options);
      return Promise.resolve('CONSENT_OVERLAY_NOT_ENABLED');
    }

    if (hasTransientUserActivation()) {
      this.openDirect(url, type, options);
      if (!this.isBlocked()) return Promise.resolve('TRANSIENT_USER_ACTIVATION');
    }

    const overlay = new PopupConsentOverlay();
    return overlay
      .prompt(() => this.openDirect(url, type, options), options && options.popupConsentOverlay)
      .then(
        () => {
          if (this.isBlocked()) {
            throw new CbError(ErrorCodes.popupBlocked);
          }
          return 'CONSENT_OVERLAY_ACCEPTED';
        },
        (err) => {
          throw err || new CbError(ErrorCodes.popupConsentDismissed);
        }
      );
  }

  private consentOverlayEnabled(options?: WindowOpenOptions): boolean {
    if (!PopupConsentOverlay.isSupported()) return false;
    if (options && typeof options.enablePopupConsentOverlay === 'boolean') {
      return options.enablePopupConsentOverlay;
    }
    const cbInstance = Helpers.getCbInstance();
    return !!(cbInstance && cbInstance.options && cbInstance.options.enablePopupConsentOverlay);
  }

  watchClose(callback: () => void): void {
    if (!this.redirectMode) {
      var watchInterval = window.setInterval(() => {
        if (this.window && this.window.closed) {
          clearInterval(watchInterval);
          callback();
        } else if (this.window == null) {
          clearInterval(watchInterval);
        }
      }, 500);
    }
  }

  open(url: string, type: string, counter = 5): void {
    if (isMobileSafari() && !this.window) {
      return;
    }
    // Check if the window is still opened
    let referrer = Helpers.getReferrer();
    let businessEntityId = Helpers.getBusinessEntityId();
    let brandId = Helpers.getBrandId();
    const fallbackTarget = isMobileSafari() ? '_blank' : 'cb-pages';
    if (this.windowOpened || counter == 0) {
      try {
        let urlWithParam: any;
        urlWithParam = new URL(url);
        urlWithParam.searchParams.append('hp_opener', this.redirectMode ? 'chargebee_redirect' : 'chargebee');
        urlWithParam.searchParams.append('hp_referrer', referrer);
        type == PageCategory.PORTAL_PAGE &&
          businessEntityId &&
          urlWithParam.searchParams.append('be_id', businessEntityId);
        type == PageCategory.PORTAL_PAGE && brandId && urlWithParam.searchParams.append('brand_id', brandId);
        const hpTitle = Helpers.getTitleOptions(this.title);
        hpTitle && urlWithParam.searchParams.append('hp_title', hpTitle);

        if (this.redirectMode) {
          this.window.location.href = urlWithParam.href;
        } else {
          if (this.window.location) {
            this.window.location.replace(urlWithParam.href);
          } else {
            // to handle salesforce environment
            window.open(urlWithParam.href, fallbackTarget);
          }
        }
      } catch (err) {
        Logger.error(err);
        let separator = url.indexOf('?') !== -1 ? (url[url.length - 1] == '&' ? '' : '&') : '?';
        let urlWithParam = `${url}${separator}hp_opener=${
          this.redirectMode ? 'chargebee_redirect' : 'chargebee'
        }&hp_referrer=${referrer}${
          type == PageCategory.PORTAL_PAGE
            ? Helpers.getBeIdQueryParamForPortal() + Helpers.getBrIdQueryParamForPortal()
            : ''
        }${Helpers.getTitleQueryParamForHostedPage(this.title)}`;
        if (this.redirectMode) {
          this.window.location.href = urlWithParam;
        } else {
          if (this.window.location) {
            this.window.location.replace(urlWithParam);
          } else {
            // to handle salesforce environment
            window.open(urlWithParam, fallbackTarget);
          }
        }
      }
    } else {
      counter--;
      window.setTimeout(() => {
        this.open(url, type, counter);
      });
    }
  }

  close(): void {
    this.window && this.window.close();
    this.resetWindow();
  }

  resetWindow(): void {
    this.windowOpened = false;
    this.window = null;
  }

  show(): void {
    // throw new Error("Method not implemented.");
  }

  markAsOpened() {
    if (this.window && !this.window.closed) {
      this.windowOpened = true;
    }
  }

  // HP, which is opened in a new window won't send you 'close' event message.
  // so, we have periodic interval check for close callback
  closeCallWatch(Handler) {
    if (!this.redirectMode) {
      var watchInterval = window.setInterval(() => {
        if (this.window && this.window.closed) {
          clearInterval(watchInterval);
          if (Handler && Handler.page && Handler.page.callbacks && Handler.page.callbacks[CLOSE]) {
            Handler.page.callbacks[CLOSE]();
            Handler.reset();
          }
          this.resetWindow();
        }
      }, 500);
    }
  }

  setCallBacks(callbacks: CbCallbacksInterface): void {}

  getLoaderUrl(): URL {
    let jsEnv = EnvConstants.ENVIRONMENT;
    let site = undefined;
    if (Helpers.getCbInstance() && Helpers.getCbInstance().options) {
      site = Helpers.getCbInstance().options.site;
    }
    const url = new URL(`${EnvConstants.ASSET_PATH}/loader.html`);
    url.searchParams.set('site', site);
    url.searchParams.set('env', jsEnv);
    if (jsEnv === 'predev' || jsEnv === 'predev1') {
      url.searchParams.set('domain', Helpers.getCbInstance().options.domain);
    }
    return url;
  }
}
