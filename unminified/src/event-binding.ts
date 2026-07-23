import {attrValue} from '@/helpers/polyfills';
import Helpers from '@/helpers/index';
import {CbAnchorElement} from './interfaces/cb-types';
import Product from '@/models/product';
import Cart from '@/models/cart';
import Handler from '@/models/handler';

// check for data attributes

// construct url based on data attributes

// call checkout
/**
 * <a href="javascript:void(0)"
    data-cb-checkout
    data-cb-plan-id="basic"
    data-cb-plan-quantity="3"
    data-cb-addons[id][0]="addon_1"
    data-cb-addons[quantity][0]="2">Subscribe</a>
 * 
 */

export default function () {
  let cbLinks = document.querySelectorAll('[data-cb-type=checkout]');
  let cart = Helpers.getCbInstance().getCart();
  [].forEach.call(cbLinks, (link: CbAnchorElement) => {
    let product = Product.createProductFromElement(<HTMLElement>link);
    link.cbProduct = product;
    if (!attrValue(link, 'cbDisableBinding')) {
      link.addEventListener('click', (event) => {
        if (event.defaultPrevented) {
          return;
        }
        if (product.isItemsModel && product.layout) Handler.manager.setLayout(product.layout);
        cart.replaceProduct(product);
        cart.proceedToCheckout();
        event.preventDefault();
        event.stopPropagation();
      });
    }
  });
}
