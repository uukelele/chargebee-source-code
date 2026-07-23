import {Layout, PageType} from '@/constants/enums';
import Page from '@/models/page';
import CbInstance from '@/models/cb-instance';
import Ids from '@/constants/ids';
import CbContainer from '@/interfaces/cb-container';
import EnvConstants from '@/constants/environment';
import Styles from '@/styles/index';
import LogKeys from '@/constants/log-keys';
import '@/helpers/polyfills';
import {Metadata} from '@/plugins/logger/types';
import {jsonify} from '@/utils/utility-functions';
import {Host} from '@/hosted_fields/common/enums';

/* To be used only in HOST window */
export default class Helpers {
  static flags = {
    resetHandlerCalled: false,
  };

  static resetFlags() {
    Helpers.flags = {
      resetHandlerCalled: false,
    };
  }

  static setFlag(key, value) {
    if (!!~Object.keys(Helpers.flags).indexOf(key)) {
      Helpers.flags[key] = value;
    }
  }

  static getJSDomain(): string {
    return EnvConstants.JS_DOMAIN;
  }

  static getJSDomainIframeCommunication(): string {
    return EnvConstants.JS_DOMAIN;
  }

  static getDomain(): string {
    var cbInstance = this.getCbInstance();
    if (!cbInstance) return undefined;
    if (cbInstance.domain) {
      const domains = cbInstance.domain.split(',');
      if (domains.length == 1) {
        return domains[0];
      }
    }
    return Helpers.getAppDomain(cbInstance.site);
  }
  static getAppDomain(site: string): string {
    return EnvConstants.APP_DOMAIN.replace('${site}', site);
  }

  // When people change from one custom domain to another or migrate from hosted domain to their custom domain
  static getDomainsToCheck(): string[] {
    var cbInstance = this.getCbInstance();
    if (cbInstance.domain) {
      const domains = cbInstance.domain.split(',');
      if (domains.length == 1) {
        return domains;
      } else {
        domains.push(EnvConstants.APP_DOMAIN.replace('${site}', cbInstance.site));
        return domains;
      }
    }
    return [EnvConstants.APP_DOMAIN.replace('${site}', cbInstance.site)];
  }

  static getReferrer(): string {
    if (!window.location.origin) {
      return (
        window.location.protocol +
        '//' +
        window.location.hostname +
        (window.location.port ? ':' + window.location.port : '')
      );
    } else {
      return window.location.origin;
    }
  }

  static getCbInstance(): CbInstance {
    let cbContainer: CbContainer = <CbContainer>document.getElementById(Ids.CONTAINER);
    // assert for cb instance
    return cbContainer && cbContainer.cbInstance;
  }

  static getLayout(): Layout | undefined {
    const cbInstance = Helpers.getCbInstance();
    if (cbInstance && cbInstance.styleConfig.layout) {
      return cbInstance.styleConfig.layout;
    }
  }

  static createContainer(): CbContainer {
    let cbContainer: HTMLElement = window.document.createElement('div');
    cbContainer.id = Ids.CONTAINER;
    this.setCssStyle(cbContainer, 'container');
    document.body.insertBefore(cbContainer, null);
    return <CbContainer>cbContainer;
  }

  static setCssStyle(element, name): void {
    Object.keys(Styles[name]).forEach(function (key) {
      if (Styles[name][key] instanceof Array) {
        let values: Array<string> = <Array<string>>Styles[name][key];
        values.forEach((value) => (element.style[key] = value));
      } else {
        element.style[key] = Styles[name][key];
      }
    });
  }

  static isMobileOrTablet(): boolean {
    let check = false;
    (function (a) {
      if (
        /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(
          a
        ) ||
        /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(
          a.substr(0, 4)
        )
      )
        check = true;
    })(navigator.userAgent || navigator.vendor || window['opera']);
    if (check) {
      // FBMD - Iphone
      // FB_IAB - Android
      if (
        navigator.userAgent.match(/FB/) ||
        navigator.userAgent.match(/Instagram/i) ||
        navigator.userAgent.match(/GSA/i)
      ) {
        check = false;
      }
    }
    return check;
  }

  static getSiteMetaData(): Metadata {
    const cbInstance = this.getCbInstance();
    if (cbInstance) {
      return {
        site: cbInstance.site,
        domain: cbInstance.domain,
        options: cbInstance.options,
        window_url: window.location.href,
      };
    }
  }

  static sendKVL(data: any = {}) {
    // Sending message to self (handled via host-actions)
    // Cannot import cb-iframe-client (circular dependency)
    const cbjsSource = window.CbJsSource;
    data.cbjs_source = cbjsSource;
    window.postMessage(
      {
        cbEvent: true,
        targetWindowName: Ids.HOST_NAME,
        srcWindowName: Ids.HOST_NAME,
        message: {
          action: Host.Actions.CaptureKVL,
          data: jsonify(data),
        },
      },
      window.location.origin
    );
  }

  static sendLog(page: Page) {
    try {
      let data = {};
      data['key'] = LogKeys.LOGGING;

      Object.keys(page.timeLogs).forEach(function (log) {
        data[log] = page.timeLogs[log];
      });

      if (page.type == PageType.CHECKOUT) {
        data[LogKeys.HP_URL] = page.url;
      }

      Helpers.sendKVL(data);
    } catch (error) {
      // console.log(error);
    }
  }

  // TODO check and remove this method if not used
  showError(msg) {
    var cbError = window.document.getElementById(Ids.CB_ERROR);
    window.document.getElementById(Ids.CB_PLACE_HOLDER).style.display = 'none';
    cbError.innerHTML = msg;
    cbError.style.display = 'block';
  }

  appendParamsToUrl(url: string, params: {}) {}

  static genUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0,
        v = c == 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  static isPromise(obj) {
    if (!obj) return false;

    if (obj instanceof Promise) return true;
    else if (typeof obj.then === 'function') {
      // Jquery $.ajax & Promiseify libraries like Bluebird does not return native Promise
      // Instead they return thenable objects
      return true;
    }
    return false;
  }

  static isTestSite(domain = Helpers.getCbInstance().site) {
    return (domain + '').endsWith('-test');
  }

  static normalizeString(str) {
    if (typeof str !== 'string') return str;
    try {
      return str.normalize('NFKD').replace(/[\u0300-\u036F]/g, '');
    } catch (e) {
      return str;
    }
  }

  static isSPA(): boolean {
    const cbInstance = Helpers.getCbInstance();
    return !!(cbInstance && cbInstance.options && cbInstance.options.isSPA);
  }

  static getBusinessEntityId(): string | undefined {
    const cbInstance = Helpers.getCbInstance();
    return cbInstance && cbInstance.options && cbInstance.options.businessEntityId;
  }
  static getPortalToken(): string | undefined {
    const cbInstance = Helpers.getCbInstance();
    const ssoToken = cbInstance && cbInstance.authHandler && cbInstance.authHandler.ssoToken;
    if (typeof ssoToken === 'string') {
      return;
    }
    return ssoToken && ssoToken.token;
  }

  static getBeIdQueryParamForPortal(): string {
    let beId = this.getBusinessEntityId();
    return beId ? '&be_id=' + beId : '';
  }
}
