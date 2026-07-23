import Manager, {ManagerType} from '@/interfaces/cb-manager';
import Urls from '@/models/urls';
import Helpers from '@/helpers/index';
import {CLOSE} from '@/constants/callbacks';
import {CbCallbacksInterface} from '@/interfaces/cb-types';
import {Layout, PageCategory} from '@/constants/enums';
import Logger from '@/utils/logger_old';
import {isWindowsOS, isSafariMacOS, isMobileSafari} from '@/utils/utility-functions';
import EnvConstants from '@/constants/environment';

export default class CbWindowManager implements Manager {
  type: ManagerType;
  window: Window;
  windowOpened: boolean;
  redirectMode: boolean;
  layout: Layout;

  constructor({redirectMode = false} = {}) {
    this.redirectMode = redirectMode;
  }

  init(): void {
    this.type = ManagerType.WINDOW_MANAGER;
  }

  setLayout(layout: Layout) {
    this.layout = layout;
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

  openDirect(url, type, options?): void {
    if (this.window && !this.window.closed) {
      this.window.close();
    }
    let _url = url;
    if (!(options && options.skipReferrer)) {
      // TODO refactor this after checking the hot fix
      let referrer = Helpers.getReferrer();
      let businessEntityId = Helpers.getBusinessEntityId();

      try {
        let srcUrl: any;
        srcUrl = new URL(url);
        srcUrl.searchParams.append('hp_opener', this.redirectMode ? 'chargebee_redirect' : 'chargebee');
        srcUrl.searchParams.append('hp_referrer', referrer);
        this.layout && srcUrl.searchParams.append('layout', this.layout);
        type == PageCategory.PORTAL_PAGE && businessEntityId && srcUrl.searchParams.append('be_id', businessEntityId);
        _url = srcUrl.href;
      } catch (err) {
        Logger.error(err);
        let separator = url.indexOf('?') !== -1 ? (url[url.length - 1] == '&' ? '' : '&') : '?';
        let srcUrl: string = `${url}${separator}hp_opener=${
          this.redirectMode ? 'chargebee_redirect' : 'chargebee'
        }&hp_referrer=${referrer}${type == PageCategory.PORTAL_PAGE ? Helpers.getBeIdQueryParamForPortal() : ''}`;
        if (typeof this.layout !== 'undefined') {
          srcUrl += `&layout=${this.layout}`;
        }
        _url = srcUrl;
      }
    }

    // https://mychargebee.atlassian.net/browse/CHKOUTENGG-39198 windows fullscreen fix
    let windowFeatures = '';
    if (options && options.openInNewWindow && !isWindowsOS() && !isSafariMacOS()) {
      windowFeatures = `toolbar=no, location=yes, status=no, menubar=no, scrollbars=yes, resizable=yes`;
    }

    this.window = this.redirectMode ? window.top : window.open(_url, type, windowFeatures);

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
        }&hp_referrer=${referrer}${type == PageCategory.PORTAL_PAGE ? Helpers.getBeIdQueryParamForPortal() : ''}`;
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
