import '@/public_path';
import Helpers from '@/helpers/index';
import CbInstanceOptions from '@/interfaces/cb-instance-options';
import Handler from '@/models/handler';
import CbInstance from '@/models/cb-instance';
import initEventListener from '@/event-listener';
import bindEvents from '@/event-binding';
import {CbAnchorElement} from 'interfaces/cb-types';
import {attrValue} from '@/helpers/polyfills';
import {Layout, SectionType} from '@/constants/enums';
import Ids from '@/constants/ids';
import CbContainer from '@/interfaces/cb-container';
import {PricingTable} from './interfaces/cb-pricing-table';
import {CancelPageUninitialised} from './interfaces/cb-cancel-page';
import {PersonalizedOffersUninitialised} from './interfaces/cb-personalized-offers';
import {CbLogger} from './cb-logger';

declare global {
  interface Window {
    Chargebee: any;
    Pricify: PricingTable;
    ChurnDeflection: CancelPageUninitialised;
    PersonalizedOffers: PersonalizedOffersUninitialised;
    CbLogger: CbLogger;
    CbJsSource: string;
  }
}

export class Chargebee {
  private static inited;

  /**
   * Initializes the Chargebee.js instance with the provided options.
   *
   * @param {CbInstanceOptions} options - The options to configure the Chargebee.js instance.
   * @returns {CbInstance} The initialized Chargebee.js instance.
   * @throws {Error} Throws an error if initialization is attempted when the instance has already been initialized.
   *
   * @example
   * const options = {
   * };
   * const cbInstance = Chargebee.init(options);
   */
  static init(options: CbInstanceOptions): CbInstance {
    if (this.inited) {
      let tmp = this.getInstance();
      if (tmp) {
        console.warn('Chargebee.js has been already initialized');
        return tmp;
      } else {
        this.inited = false;
      }
    }
    var cbInstance = new CbInstance(options);
    bindEvents();
    initEventListener();
    Handler.init(options);
    this.inited = true;
    window.CbLogger = new CbLogger();
    window.CbLogger.info('Chargebee', 'init', 'Chargebee.js initialized', true);
    return cbInstance;
  }

  static getPortalSections() {
    return SectionType;
  }

  static getInstance() {
    if (this.inited) {
      return Helpers.getCbInstance();
    } else {
      throw new Error('Instance not created');
    }
  }

  static tearDown() {
    if (Helpers.getCbInstance()) {
      let cbContainer: CbContainer = <CbContainer>document.getElementById(Ids.CONTAINER);
      cbContainer.cbInstance = null;
      if (cbContainer) cbContainer.remove();
    }
    Handler.styleLoaded = null;
    this.inited = false;
  }

  static registerAgain() {
    bindEvents();
    registerPortal(Helpers.getCbInstance());
  }
}

var registerPortal = function (cbInstance: CbInstance) {
  let cbPortalLinks = document.querySelectorAll('[data-cb-type=portal]');
  if (cbPortalLinks.length > 0) {
    let cbPortal = cbInstance.createChargebeePortal();
    [].forEach.call(cbPortalLinks, (cbPortalLink: CbAnchorElement) => {
      cbPortalLink.cbPortal = cbPortal;
      cbPortalLink.addEventListener('click', (event) => {
        if (event.defaultPrevented) {
          return;
        }
        cbPortalLink.cbPortal.open();
        event.preventDefault();
        event.stopPropagation();
      });
    });
  }
};

if (!window.Chargebee) {
  window.Chargebee = Chargebee;
  let scriptElements = document.getElementsByTagName('script');
  [].forEach.call(scriptElements, (element: HTMLScriptElement) => {
    if (attrValue(element, 'cbSite')) {
      let gaEnabled = attrValue(element, 'cbGaEnabled');
      let fbqEnabled = attrValue(element, 'cbFbqEnabled');
      let refersionEnabled = attrValue(element, 'cbRefersionEnabled');
      let friendBuyEnabled = attrValue(element, 'cbFriendbuyEnabled');
      let redirectModeEnabled = attrValue(element, 'cbRedirectModeEnabled');
      let topLevelRedirectOnSuccess = attrValue(element, 'cbTopLevelRedirectOnSuccess');
      let gtmEnabled = attrValue(element, 'cbGtmEnabled');
      let iframeOnlyEnabled = attrValue(element, 'cbIframeOnly');
      let recaptchaKey = attrValue(element, 'cbRecaptchaKey');
      let isItemsModel = attrValue(element, 'cbItemsModel');
      const businessEntityId = attrValue(element, 'cbBusinessEntityId');
      const brandId = attrValue(element, 'cbBrandId');
      (function () {
        // @ts-ignore
        if (
          document.readyState === 'complete' ||
          // @ts-ignore
          document.readyState === 'loaded'
        ) {
          let cbInstance = Chargebee.init({
            site: attrValue(element, 'cbSite'),
            domain: attrValue(element, 'cbDomain'),
            enableGATracking: !!gaEnabled,
            enableFBQTracking: !!fbqEnabled,
            enableRefersionTracking: !!refersionEnabled,
            enableFriendbuyTracking: !!friendBuyEnabled,
            enableRedirectMode: !!redirectModeEnabled,
            enableTopLevelRedirectOnSuccess: !!topLevelRedirectOnSuccess,
            iframeOnly: !!iframeOnlyEnabled,
            enableGTMTracking: !!gtmEnabled,
            referrerModule: attrValue(element, 'cbReferrerModule'),
            recaptchaKey,
            isItemsModel: !!isItemsModel,
            businessEntityId,
            brandId,
          });

          registerPortal(cbInstance);
        }

        document.addEventListener('DOMContentLoaded', () => {
          let cbInstance = Chargebee.init({
            site: attrValue(element, 'cbSite'),
            domain: attrValue(element, 'cbDomain'),
            enableGATracking: !!gaEnabled,
            enableFBQTracking: !!fbqEnabled,
            enableRefersionTracking: !!refersionEnabled,
            enableFriendbuyTracking: !!friendBuyEnabled,
            enableRedirectMode: !!redirectModeEnabled,
            enableTopLevelRedirectOnSuccess: !!topLevelRedirectOnSuccess,
            iframeOnly: !!iframeOnlyEnabled,
            enableGTMTracking: !!gtmEnabled,
            referrerModule: attrValue(element, 'cbReferrerModule'),
            recaptchaKey,
            businessEntityId,
            brandId,
          });

          registerPortal(cbInstance);
        });
      })();
    }
  });
}
