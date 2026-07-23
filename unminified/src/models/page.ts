import {Layout, PageType} from '@/constants/enums';
import {CbCallbacksInterface, TimeLogs, PageOptions, HostedPageData} from '@/interfaces/cb-types';
import Callbacks from '@/callbacks/index';
import {CHECKOUT_CALLBACK_KEYS, PORTAL_CALLBACK_KEYS} from '@/constants/callbacks';

export default class Page {
  type: PageType;
  callbacks: CbCallbacksInterface;
  timeLogs: TimeLogs;
  urlFetcher: () => Promise<HostedPageData>;
  url: string;
  name: string;
  options: {} = {};
  layout?: Layout;

  constructor(pageType: PageType, options: PageOptions) {
    this.type = pageType;
    this.callbacks = {};
    this.timeLogs = {};
    this.init(options);
  }

  init(options: PageOptions) {
    if (typeof options.hostedPage === 'function') {
      this.urlFetcher = options.hostedPage;
    } else if (options.hostedPageUrl) {
      this.url = options.hostedPageUrl;
    } else {
      // TODO assert if url is not empty
      this.url = options.url;
    }

    if (typeof options.layout !== 'undefined') {
      this.layout = options.layout;
    }

    if (options.hostedPage && typeof options.hostedPage !== 'function') {
      const error = new Error(
        "The property 'hostedPage' should be a function returning a promise, which resolves to a hosted page object. \
      Ref: https://www.chargebee.com/checkout-portal-docs/api-checkout.html#opening-chargebee-checkout"
      );
      console.error(error);
    }

    // TODO find a way to string type options[callback]
    // This will always return new CbTotalCallbacks object
    let callbackDefns = Callbacks.getDefaultCallbackDefns(this.type);
    this.getAvailableCallbackKeys().forEach((callbackKey) => {
      if (options[callbackKey]) {
        if (!callbackDefns[callbackKey]) {
          callbackDefns[callbackKey] = [];
        }
        callbackDefns[callbackKey].push(options[callbackKey]);
      }
    });

    // construct set of callbacks and assign
    Object.keys(callbackDefns).forEach((callbackKey) => {
      this.callbacks[callbackKey] = this.constructCallbackDefn(callbackDefns[callbackKey]);
    });
  }

  private constructCallbackDefn(callbackDefns: Array<Function>): Function {
    return function () {
      callbackDefns.forEach((defn) => {
        defn.apply(undefined, arguments);
      });
    };
  }

  private getAvailableCallbackKeys(): Array<string> {
    switch (this.type) {
      case PageType.CHECKOUT:
        return CHECKOUT_CALLBACK_KEYS;
      case PageType.PORTAL:
        return PORTAL_CALLBACK_KEYS;
      default:
        throw new Error('Page Type not supported');
    }
  }
}
