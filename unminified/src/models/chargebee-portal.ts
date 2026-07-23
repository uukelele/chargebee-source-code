import Transformer from '@/helpers/transformer';
import {SectionType} from '@/constants/enums';
import {CbCallbacksInterface} from '@/interfaces/cb-types';
import Handler from '@/models/handler';
import Urls from '@/models/urls';
import CbInstance from '@/models/cb-instance';
import {CbPortalOptions, CbPortalForwardOptions} from '@/interfaces/cb-portal-options';
import Page from '@/models/page';
import {PageType} from '@/constants/enums';
import {SUBSCRIPTION_SECTIONS, PAYMENT_METHOD_SECTIONS, SUPPORTED_SECTIONS_SEPARATE_CARDS} from '@/constants/sections';

export default class ChargebeePortal {
  /** @internal */
  cbInstance: CbInstance;

  /** @internal */
  callbacks: CbCallbacksInterface = {};

  /** @internal */
  constructor(cbInstance: CbInstance) {
    this.cbInstance = cbInstance;
  }

  open(options: CbPortalOptions = {}, forwardOptions?: CbPortalForwardOptions) {
    if (!options.pageType) {
      Object.assign(options, this.cbInstance.portalCallbacks);
      Object.assign(options, this.callbacks);
      var page = new Page(PageType.PORTAL, options);
      page.name = 'home';
      if (forwardOptions) {
        page.options = this.getValidatedOptions(forwardOptions);
      }
      Handler.submit(page);
    } else {
      // TODO handle other pagetype options
    }
  }

  openSection(sectionOptions: CbPortalForwardOptions, options: CbPortalOptions = {}) {
    if (sectionOptions && sectionOptions.sectionType) {
      // TODO DRY code with above function
      let forwardOptions = this.getValidatedOptions(sectionOptions, true);
      Object.assign(options, this.cbInstance.portalCallbacks);
      Object.assign(options, this.callbacks);
      var page = new Page(PageType.PORTAL, options);
      page.name = sectionOptions.sectionType;
      if (forwardOptions) {
        page.options = forwardOptions;
      }
      Handler.submit(page);
    } else {
      throw new Error('section type should be passed.');
    }
  }

  private getValidatedOptions(forwardOptions: CbPortalForwardOptions, separateCard?: boolean): {} {
    if (!forwardOptions.sectionType) {
      throw new Error('section type should be present');
    }

    if (!Object.keys(SectionType).some((sectionType) => SectionType[sectionType] == forwardOptions.sectionType)) {
      throw new Error(`section type ${forwardOptions.sectionType} is not present`);
    }

    if (SUBSCRIPTION_SECTIONS.indexOf(forwardOptions.sectionType as SectionType) > -1) {
      if (!(forwardOptions.params && forwardOptions.params['subscriptionId'])) {
        throw new Error('subscription id should be present');
      }
    }

    if (PAYMENT_METHOD_SECTIONS.indexOf(forwardOptions.sectionType as SectionType) > -1) {
      if (!(forwardOptions.params && forwardOptions.params['paymentSourceId'])) {
        throw new Error('payment source id should be present');
      }
    }

    if (!separateCard) {
      return this.getForwardParams(forwardOptions);
    } else {
      if (SUPPORTED_SECTIONS_SEPARATE_CARDS.indexOf(forwardOptions.sectionType as SectionType) == -1) {
        throw new Error(`section type ${forwardOptions.sectionType} cannot be opened separately`);
      }
      return this.getSectionParams(forwardOptions);
    }
  }

  private getSectionParams(forwardOptions: CbPortalForwardOptions): {} {
    let params = Object.assign(forwardOptions.params || {});
    return Transformer.flatten(params, 'fw');
  }

  private getForwardParams(forwardOptions: CbPortalForwardOptions): {} {
    let params = Object.assign(
      {
        name: forwardOptions.sectionType,
      },
      forwardOptions.params || {}
    );

    return Transformer.flatten(params, 'fwt');
  }
}
