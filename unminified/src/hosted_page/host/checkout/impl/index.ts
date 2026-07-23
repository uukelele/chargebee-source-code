import Errors, {CbError} from '@/hosted_fields/common/errors';
import {generateHtmlElement, getElementById, isElement, strToHTML} from '@/hosted_fields/common/dom-utils';
import {Checkout} from '@/hosted_page/host/checkout';
import EventInterface, {combineDefaultCallbacks, EventCallbacks} from '@/hosted_page/host/event/event-interface';
import {CLOSE, SUCCESS} from '@/constants/callbacks';
import {PageType} from '@/constants/enums';
import {V4LoaderIconSVG} from '@/hosted_fields/component/templates/loader-template';
import Helpers from '@/helpers';
import Callbacks from '@/callbacks';
import {URL} from 'url';
import {isDev} from '@/constants/environment';
import {getGAPurchaseAckPromise, getPurchaseEventFiredAt} from '@/callbacks/ga-callbacks';

const CbFrameId = 'cb-checkout-frame';
const CB_CHECKOUT_LOADER = 'cb-checkout-loader';
const REDIRECT_TIMEOUT_MS = 3000;
/** Delay after sending KVL before redirect so the request can be sent before page unload */
const KVL_SEND_DELAY_MS = 1000;

function performRedirect(redirectUrl: string, resolvedBy: 'event_callback' | 'timeout', customerId?: string) {
  const firedAt = getPurchaseEventFiredAt();
  const waitMs = firedAt ? Date.now() - firedAt : null;
  try {
    const kvlPayload: Record<string, unknown> = {
      module: 'chargebee.js',
      redirectUrl: new URL(redirectUrl).host,
      ga_redirect_after_delay: true,
      ga_resolved_by: resolvedBy,
      ga_wait_ms: waitMs,
    };
    if (customerId != null) {
      kvlPayload.customerId = customerId;
    }
    Helpers.sendKVL(kvlPayload);
  } catch (ex) {
    if (isDev()) console.warn('KVL send failed (ga_redirect_after_delay)', ex);
  }
  const doNavigate = () => {
    const cbInstance = Helpers.getCbInstance();
    if (cbInstance && cbInstance.enableTopLevelRedirectOnSuccess) {
      try {
        window.top.location = redirectUrl;
      } catch (ex) {
        window.location.href = redirectUrl;
      }
    } else {
      window.location.href = redirectUrl;
    }
  };
  window.setTimeout(doNavigate, KVL_SEND_DELAY_MS);
}

const onSuccessHandler = {
  [SUCCESS](hostedPageId, data, redirectUrl, customerId?: string) {
    if (redirectUrl) {
      const gaPurchaseAck = getGAPurchaseAckPromise();
      const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, REDIRECT_TIMEOUT_MS));

      if (gaPurchaseAck != null) {
        let settled = false;
        gaPurchaseAck.then(() => {
          if (settled) return;
          settled = true;
          performRedirect(redirectUrl, 'event_callback', customerId);
        });
        timeoutPromise.then(() => {
          if (settled) return;
          settled = true;
          performRedirect(redirectUrl, 'timeout', customerId);
        });
      } else {
        timeoutPromise.then(() => performRedirect(redirectUrl, 'timeout', customerId));
      }
    }
  },
};

export default class CheckoutImpl implements Checkout {
  private readonly callbacks: EventCallbacks = null;
  private readonly url: URL;

  private container: HTMLElement = null;
  private iframe: HTMLIFrameElement = null;
  private eventListenerId: string = null;

  constructor(url: URL, callbacks: EventCallbacks) {
    this.url = url;
    let updatedCallbacks = Callbacks.getDefaultCallbackDefns(PageType.CHECKOUT);
    updatedCallbacks = Callbacks.mergeCallbackDefns(updatedCallbacks, onSuccessHandler);
    updatedCallbacks = Callbacks.mergeCallbackDefns(updatedCallbacks, callbacks);
    this.callbacks = combineDefaultCallbacks(updatedCallbacks);
  }

  public mount(target: string | HTMLElement): Promise<boolean> {
    const container: HTMLElement = getElementById(target);
    if (!container || !isElement(container)) {
      throw new CbError(Errors.noContainerElement, {
        field: 'Checkout',
        entity: 'Component',
      });
    }
    if (container.children.namedItem(CbFrameId)) {
      console.error(
        new CbError(Errors.componentAlreadyPresent, {
          field: 'Checkout',
          entity: 'Component',
        })
      );
      return;
    }
    this.container = container;
    this.toggleLoader(true);
    const iframe = generateHtmlElement('iframe', {
      border: '0px',
      overflow: 'hidden',
      display: 'none',
    });
    iframe.width = '100%';
    iframe.height = '100%';
    iframe.id = iframe.name = CbFrameId;
    iframe.src = this.url.href;
    iframe.onload = () => {
      this.toggleLoader(false);
      iframe.style.display = 'block';
    };
    container.appendChild(iframe);
    this.iframe = iframe;
    this.eventListenerId = EventInterface.registerListener(this.callbacks, PageType.CHECKOUT);
    return Promise.resolve(true);
  }

  toggleLoader(showLoader: boolean): void {
    let loader: HTMLElement | null = document.getElementById(CB_CHECKOUT_LOADER);
    if (!loader && showLoader) {
      loader = generateHtmlElement('div', {
        margin: '0',
        padding: '0',
        display: 'block',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
        border: 'none',
        overflow: 'hidden',
      });
      loader.id = CB_CHECKOUT_LOADER;
      loader.appendChild(
        (() => {
          let circularProgress = generateHtmlElement('div', {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            height: '100%',
            top: '0',
            right: '0',
            bottom: '0',
            left: '0',
            backgroundColor: '#f4f5f9',
            opacity: '.75',
            visibility: 'visible',
          });
          circularProgress.appendChild(<SVGElement>strToHTML(V4LoaderIconSVG));
          return circularProgress;
        })()
      );
      this.container.appendChild(loader);
    }
    if (!showLoader) {
      this.container.removeChild(loader);
    }
  }

  close() {
    this.callbacks[CLOSE] && this.callbacks[CLOSE]();
    if (this.container && this.iframe) {
      this.container.removeChild(this.iframe);
    }
    if (this.container) {
      this.container = null;
    }
    if (this.iframe) {
      this.iframe.src = '';
      this.iframe.style.display = 'none';
      this.iframe.style.visibility = 'hidden';
      this.iframe = null;
    }
    if (this.eventListenerId) {
      EventInterface.unregisterListener(this.eventListenerId);
    }
  }
}
