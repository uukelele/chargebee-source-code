import {TimeOuts} from '@/interfaces/cb-types';
import Handler from '@/models/handler';
import Manager, {ManagerType} from '@/interfaces/cb-manager';
import Helpers from '@/helpers/index';
import Ids from '@/constants/ids';
import Urls from '@/models/urls';
import {CLOSE} from '@/constants/callbacks';
import {CbCallbacksInterface} from '@/interfaces/cb-types';
import {Layout, PageCategory} from '@/constants/enums';
import {V4LoaderIconSVG} from '@/hosted_fields/component/templates/loader-template';
import {strToHTML} from '@/hosted_fields/common/dom-utils';
import Logger from '@/utils/logger_old';
import EnvConstants from '@/constants/environment';
let timeOuts: TimeOuts = {};

export default class CbIframeManager implements Manager {
  type: ManagerType;
  bodySettings: {} = {};
  callbacks: CbCallbacksInterface;
  layout: Layout;

  init(): void {
    this.attachIframeAndLoader();
    this.type = ManagerType.IFRAME_MANAGER;
  }

  setLayout(layout: Layout) {
    this.layout = layout;
  }

  showLoader(): void {
    if (typeof this.layout !== 'undefined' && this.layout === Layout.FULL_PAGE) {
      this.showFullPageLoader();
    } else {
      this.showInAppLoader();
    }
  }

  showFullPageLoader(): void {
    let cbContainer = window.document.getElementById(Ids.CONTAINER);
    cbContainer.style.background = 'rgba(0,0,0,.702)'; // Should set background from in checkout itself
    cbContainer.style.display = 'block';
    let cbLoader = window.document.getElementById(Ids.CB_LOADER);
    Helpers.setCssStyle(cbLoader, 'loader_fullpage_checkout');
    let inappWrapper = <HTMLElement>cbLoader.firstElementChild;
    inappWrapper.style.visibility = 'hidden';
    cbLoader.style.visibility = 'visible';
    let v4LoaderId = 'wrapper_v4Checkout';
    let wrapper = document.getElementById(v4LoaderId);
    if (!wrapper) {
      wrapper = window.document.createElement('div');
      wrapper.id = v4LoaderId;
      Helpers.setCssStyle(wrapper, 'loader_v4');
      let v4_loader_icon = <SVGElement>strToHTML(V4LoaderIconSVG);
      wrapper.appendChild(v4_loader_icon);
    } else {
      wrapper.style.visibility = 'visible';
    }
    cbLoader.appendChild(wrapper);
  }

  showInAppLoader() {
    this.addStyleTag();
    let cbContainer = window.document.getElementById(Ids.CONTAINER);
    let logo = window.document.getElementById(Ids.CB_HEADER_LOGO);
    let loadingBar = window.document.getElementById(Ids.CB_LOADING_BAR);
    cbContainer.style.background = 'rgba(0,0,0,.702)';
    cbContainer.style.display = 'block';
    let styleConfig = Helpers.getCbInstance().styleConfig;
    if (styleConfig.image) {
      logo.setAttribute('src', styleConfig.image);
    }

    if (styleConfig.color) {
      loadingBar.style.background = styleConfig.color;
    }
    // show white background with loader
    let cbLoader = window.document.getElementById(Ids.CB_LOADER);
    cbLoader.style.marginTop = '0px';
    let wh = window.innerHeight;
    let minHeight = 480; //card height
    if (document.body.clientWidth < minHeight) {
      Helpers.setCssStyle(cbLoader, 'loader_container_mobile');
    } else {
      Helpers.setCssStyle(cbLoader, 'loader_container_web');
      if (wh - minHeight > 20) {
        //min-margin 20 px
        cbLoader.style.marginTop = (wh - minHeight) / 2.0 + 'px';
      }
    }
    let v4Wrapper = <HTMLElement>document.getElementById('wrapper_v4Checkout');
    if (v4Wrapper) {
      v4Wrapper.style.visibility = 'hidden';
      let inappWrapper = <HTMLElement>cbLoader.firstElementChild;
      inappWrapper.style.visibility = 'visible';
    }
    cbLoader.style.visibility = 'visible';
    // TODO should we move selectors to constants?
    let dummyEl = document.querySelectorAll('.cb-placeholder')[0];

    if (typeof getComputedStyle !== 'undefined' && dummyEl) {
      let style = window.getComputedStyle(dummyEl, null);
      if (!(style && style.getPropertyValue('background-color') == 'rgb(244, 245, 249)')) {
        this.createKeyFrameAnimation();
      } else {
        let placeholderItems: NodeListOf<Element> = document.querySelectorAll('#cb-placeholder > div');
        for (let i = placeholderItems.length - 1; i >= 0; i--) {
          (<HTMLElement>placeholderItems[i]).style.animationDelay = i * 0.1 + 's';
        }
      }
    }
  }

  open(url: string, type: string): void {
    let referrer = Helpers.getReferrer();
    let businessEntityId = Helpers.getBusinessEntityId();
    let brandId = Helpers.getBrandId();
    let cbFrame = <HTMLIFrameElement>window.document.getElementById(Ids.CB_FRAME);
    let cbInstance = Helpers.getCbInstance();
    cbFrame.style.display = 'block';
    try {
      let srcUrl: any;
      srcUrl = new URL(url);
      srcUrl.searchParams.append('hp_opener', 'chargebee');
      srcUrl.searchParams.append('hp_referrer', referrer);
      this.layout && srcUrl.searchParams.append('layout', this.layout);
      if (type == PageCategory.PORTAL_PAGE) {
        if (businessEntityId) {
          srcUrl.searchParams.append('be_id', businessEntityId);
        } else {
          //attaching the token in case of authenticated usecase
          //and when be id is not present so that the be_id can be fetched from the token.
          if (cbInstance && cbInstance.authenticated) {
            let token = Helpers.getPortalToken();
            if (!srcUrl.searchParams.has('token') && token) {
              srcUrl.searchParams.append('token', token);
            }
          }
        }
        if (brandId) {
          srcUrl.searchParams.append('brand_id', brandId);
        }
      }
      srcUrl.searchParams.append('window_referrer', window.location.href);
      cbFrame.src = srcUrl.href;
    } catch (err) {
      Logger.error(err);
      let separator = url.indexOf('?') !== -1 ? (url[url.length - 1] == '&' ? '' : '&') : '?';
      let srcUrl: string;
      if (typeof this.layout !== 'undefined') {
        srcUrl = `${url}${separator}hp_opener=chargebee&hp_referrer=${encodeURIComponent(referrer)}&layout=${
          this.layout
        }${
          type == PageCategory.PORTAL_PAGE
            ? Helpers.getBeIdQueryParamForPortal() + Helpers.getBrIdQueryParamForPortal()
            : ''
        }`;
      } else {
        srcUrl = `${url}${separator}hp_opener=chargebee&hp_referrer=${encodeURIComponent(referrer)}${
          type == PageCategory.PORTAL_PAGE
            ? Helpers.getBeIdQueryParamForPortal() + Helpers.getBrIdQueryParamForPortal()
            : ''
        }`;
      }
      cbFrame.src = srcUrl;
    }
    cbFrame.title = type;
    // this.bodySettings.height = document.body.style.height;
    // document.body.style['height'] = window.innerHeight + "px";
    this.bodySettings['overflow'] = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  close(): void {
    let cbContainer = window.document.getElementById(Ids.CONTAINER);
    cbContainer.style.display = 'none';
    let cbFrame = <HTMLIFrameElement>window.document.getElementById(Ids.CB_FRAME);
    cbFrame.src = '';
    cbFrame.style.display = 'none';
    cbFrame.style.visibility = 'hidden';
    document.body.style.overflow = this.bodySettings['overflow'];
  }

  show(): void {
    let cbFrame = window.document.getElementById(Ids.CB_FRAME);
    let cbContainer = window.document.getElementById(Ids.CONTAINER);
    let cbLoader = window.document.getElementById(Ids.CB_LOADER);
    let cbLoaderBar = window.document.getElementById(Ids.CB_LOADING_BAR);
    cbLoader.style.boxShadow = 'none';
    cbFrame.style.visibility = 'visible';
    window.setTimeout(() => {
      cbLoader.style.visibility = 'hidden';
      cbLoaderBar.style.visibility = 'hidden';
      clearTimeout(timeOuts['timeOut1']);
      clearTimeout(timeOuts['timeOut2']);
      clearTimeout(timeOuts['timeOut3']);
    }, 1000);
  }

  private createKeyFrameAnimation() {
    let elem = document.getElementById('cb-loading-bar');
    // elem.style.visibility = 'visible';
    elem.style.transform = 'translateX(-100%)';
    let frame = () => {
      timeOuts['timeOut1'] = window.setTimeout(() => {
        elem.style.transform = 'translateX(0%)';
        elem.style.visibility = 'visible';
      }, 500);
      timeOuts['timeOut2'] = window.setTimeout(() => {
        elem.style.transform = 'translateX(100%)';
        elem.style.visibility = 'hidden';
      }, 1000);
      timeOuts['timeOut3'] = window.setTimeout(() => {
        elem.style.transform = 'translateX(-100%)';
        elem.style.visibility = 'hidden';
        frame();
      }, 1500);
    };
    frame();
  }

  private addStyleTag(): void {
    let resource = document.createElement('link');
    resource.setAttribute('rel', 'stylesheet');
    // @ts-ignore
    resource.setAttribute('href', `${EnvConstants.ASSET_PATH}/animation.css`);
    resource.setAttribute('type', 'text/css');

    let head = document.getElementsByTagName('head')[0];
    head.appendChild(resource);
  }

  private attachIframeAndLoader(): void {
    let cbContainer = document.getElementById(Ids.CONTAINER);
    let iframe = this.createIframe();
    let loader = this.createLoader();
    cbContainer.insertBefore(loader, null);
    cbContainer.insertBefore(iframe, null);
  }

  private createIframe(): HTMLIFrameElement {
    let iframe = window.document.createElement('iframe');
    iframe.id = Ids.CB_FRAME;
    Helpers.setCssStyle(iframe, 'iframe');
    return iframe;
  }

  private createLoader(): HTMLDivElement {
    let loaderContainer = window.document.createElement('div');
    loaderContainer.id = Ids.CB_LOADER;

    // TODO move this utility methods and refactor the code

    Helpers.setCssStyle(loaderContainer, 'loader_container');
    let wrapper = window.document.createElement('div');
    Helpers.setCssStyle(wrapper, 'loader_wrapper');

    let header = this.createHeader();
    let content = this.createContent();
    let loadingBar = this.createLoadingBar();
    let close = this.createCloseButton();
    wrapper.appendChild(header);
    wrapper.appendChild(loadingBar);
    wrapper.appendChild(content);
    wrapper.appendChild(close);
    loaderContainer.appendChild(wrapper);
    return loaderContainer;
  }

  private createHeader(): HTMLDivElement {
    var loaderHeader = window.document.createElement('div');
    loaderHeader.id = Ids.CB_LOADER_HEADER;
    Helpers.setCssStyle(loaderHeader, 'loader_header');
    var loaderHeaderLogo = window.document.createElement('div');
    Helpers.setCssStyle(loaderHeaderLogo, 'loader_header_logo');
    var img = window.document.createElement('img');
    img.id = Ids.CB_HEADER_LOGO;
    Helpers.setCssStyle(img, 'loader_header_img');
    loaderHeaderLogo.appendChild(img);
    loaderHeader.appendChild(loaderHeaderLogo);
    return loaderHeader;
  }

  private createContent(): HTMLDivElement {
    let loaderContent = window.document.createElement('div');
    Helpers.setCssStyle(loaderContent, 'loader_content');
    // creating placeholder items
    let placeholder = window.document.createElement('div');
    placeholder.setAttribute('class', 'cb-placeholder');
    placeholder.id = 'cb-placeholder';
    let placeholderMd = window.document.createElement('div');
    Helpers.setCssStyle(placeholderMd, 'placeholder_md');
    placeholderMd.setAttribute('class', 'wavering');
    Helpers.setCssStyle(placeholderMd, 'wavering');

    let placeholderLg = window.document.createElement('div');
    Helpers.setCssStyle(placeholderLg, 'placeholder_lg');
    placeholderLg.setAttribute('class', 'wavering');
    Helpers.setCssStyle(placeholderLg, 'wavering');

    let placeholderSm = window.document.createElement('div');
    Helpers.setCssStyle(placeholderSm, 'placeholder_sm');
    placeholderSm.setAttribute('class', 'wavering');
    Helpers.setCssStyle(placeholderSm, 'wavering');

    placeholder.appendChild(placeholderMd);
    placeholder.appendChild(placeholderLg);
    placeholder.appendChild(placeholderSm);
    placeholder.appendChild(placeholderSm.cloneNode());
    placeholder.appendChild(placeholderSm.cloneNode());

    let errorContainer = window.document.createElement('div');
    errorContainer.id = Ids.CB_ERROR;
    Helpers.setCssStyle(errorContainer, 'cb_error');
    loaderContent.appendChild(placeholder);
    loaderContent.appendChild(errorContainer);
    return loaderContent;
  }

  private createLoadingBar() {
    let loadingBar = window.document.createElement('div');
    loadingBar.id = Ids.CB_LOADING_BAR;
    Helpers.setCssStyle(loadingBar, 'loading_bar');
    return loadingBar;
  }

  private createCloseButton(): HTMLDivElement {
    let close = window.document.createElement('div');
    close.innerHTML = '&#215;';
    close.id = Ids.CB_MODAL_CLOSE;
    Helpers.setCssStyle(close, 'loading_close');
    let eventMethod = window.addEventListener ? 'addEventListener' : 'attachEvent';
    close[eventMethod]('click', () => {
      this.callbacks[CLOSE] && this.callbacks[CLOSE]();
      this.close();
    });
    return close;
  }

  static createHiddenIFrame(id): HTMLIFrameElement {
    let iframe = window.document.createElement('iframe');
    iframe.id = id;
    Helpers.setCssStyle(iframe, 'iframe_hidden');

    let cbContainer = window.document.getElementById(Ids.CONTAINER);
    cbContainer.insertBefore(iframe, null);
    return iframe;
  }

  setCallBacks(callbacks: CbCallbacksInterface): void {
    this.callbacks = callbacks;
  }
}
