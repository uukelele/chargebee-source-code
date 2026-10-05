import PluginLoader from '@/plugins/core/loader';
import {CheckoutOptions} from '@/hosted_page/host/checkout/types';
import HostedPagePlugin from '@/plugins/hosted_page/host';
import CheckoutImpl from '@/hosted_page/host/checkout/impl';
import {Checkout} from '@/hosted_page/host/checkout';
import Cart from '@/models/cart';
import Helpers from '@/helpers';
import Errors, {CbError} from '@/hosted_fields/common/errors';

declare var Chargebee: any;

export class HostedPagePluginImpl extends PluginLoader implements HostedPagePlugin {
  loadCheckout(options: CheckoutOptions): Checkout {
    if (!options || (!options.url && !options.cart)) {
      throw new CbError(Errors.missingMandatoryParameters, {
        parameters: 'url/cart',
        target: 'loadCheckout',
      });
    }
    let url = options.url || undefined;
    if (options.cart instanceof Cart) {
      url = options.cart.generateUrl();
    }
    let srcUrl = new URL(url);
    srcUrl.searchParams.append('hp_opener', 'chargebee');
    srcUrl.searchParams.append('hp_referrer', Helpers.getReferrer());
    const hpTitle = Helpers.getTitleOptions(options.title);
    hpTitle && srcUrl.searchParams.append('hp_title', hpTitle);
    return new CheckoutImpl(srcUrl, options.callbacks);
  }
}

Chargebee.getInstance().hostedPagePlugin = new HostedPagePluginImpl();
