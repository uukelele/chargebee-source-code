import Helpers from '@/helpers/index';
import Fillers from '@/helpers/fillers';
import Addon from '@/models/addon';
import Product from '@/models/product';
import {setItemsForProduct} from '@/models/item';
import {Address, Customer, CbCallbacksInterface} from '@/interfaces/cb-types';
import Assert from '@/helpers/asserts';
import Urls from '@/models/urls';
import Transformer from '@/helpers/transformer';

export default class Cart {
  products: Array<Product> = [];
  shippingAddress: Address = {};
  customer: Customer = {billing_address: {}};
  affiliateToken: string;
  businessEntityId: string;
  brandId: string;

  callbacks: CbCallbacksInterface = {};

  addItem(item: Product): Cart {
    // There will be only one order item as of now
    // Implementation may change when we start implementing mulitple order items
    Assert.notTrue(
      () => this.products.length == 0 || this.products.some((i) => i.planId != item.planId),
      'Only one product with the same plan id can be present'
    );
    this.products.push(item);
    return this;
  }

  replaceProduct(product: Product): Cart {
    this.products = [product];
    return this;
  }

  fetchItem(planId: string): Product {
    return this.products.filter((o) => o.planId == planId)[0];
  }

  removeItem(item: Product): Cart {
    let indexToBeDeleted = this.products.indexOf(item)[0];
    if (indexToBeDeleted) {
      this.products.splice(indexToBeDeleted, 1);
    }
    return this;
  }

  calculateEstimate(): Promise<any> {
    // TODO return type should be Estimate object
    // will implement this in later versions
    return null;
  }

  setShippingAddress(address: Address): Cart {
    this.shippingAddress = address;
    return this;
  }

  setCustomer(customer: Customer): Cart {
    this.customer = customer;
    return this;
  }

  setAffiliateToken(token: string): Cart {
    this.affiliateToken = token;
    return this;
  }

  proceedToCheckout(): void {
    Assert.notTrue(() => this.products.length > 0, 'Atleast one product should be present');
    let cbInstance = Helpers.getCbInstance();
    let callbacks = {};
    if (typeof cbInstance.checkoutCallbacks === 'function') {
      Object.assign(callbacks, cbInstance.checkoutCallbacks(this));
    }

    Object.assign(callbacks, this.callbacks);

    const product = this.products[0];
    cbInstance.openCheckout(
      Object.assign(
        {
          hostedPageUrl: this.generateUrl(),
          layout: product.layout || Helpers.getLayout(),
        },
        callbacks
      )
    );
  }

  setBusinessEntity(businessEntityId: string) {
    if (typeof businessEntityId === 'string') this.businessEntityId = businessEntityId;
  }

  setBrand(brandId: string) {
    if (typeof brandId === 'string') this.brandId = brandId;
  }

  public generateUrl(domain?: string, useBaseDomain: boolean = true): string {
    let params: any = {};
    let product = this.products[0];
    if (product.isItemsModel) {
      if (product.items && product.items.length == 0) {
        setItemsForProduct(product);
      }
      // CHKOUTENGG-13275 - Remove item type
      const itemsList = product.items.map((item) => {
        const _item = {...item};
        delete _item.item_type;
        return _item;
      });
      Object.assign(params, Transformer.flattenMulti(itemsList, 'subscription_items'));

      // Adds HPV4 layout parameter
      const layout = product.layout || Helpers.getLayout();
      if (!!layout) params['layout'] = layout;

      if (this.businessEntityId && typeof this.businessEntityId === 'string')
        params['business_entity_id'] = this.businessEntityId;

      if (this.brandId && typeof this.brandId === 'string') params['brand_id'] = this.brandId;
    } else {
      if (product.planId != undefined) {
        params['planId'] = product.planId;
        if (product.planQuantity) {
          params['subscription[plan_quantity]'] = product.planQuantity;
        }
        if (product.planQuantityInDecimal) {
          params['subscription[plan_quantity_in_decimal]'] = product.planQuantityInDecimal;
        }
      } else {
        product.isOneTimeCheckout = true;
      }
      // add addons
      Object.assign(params, Transformer.flattenMulti(product.addons, 'addons'));
    }

    // add coupons
    Object.assign(params, Transformer.flatten(product.coupons, 'coupon_ids'));
    // add customer data
    Object.assign(params, Transformer.flatten(Cart.customerWithoutBillingAddress(this.customer), 'customer'));
    Object.assign(params, Transformer.flatten(this.customer.billing_address, 'billing_address'));
    // add shipping address
    Object.assign(params, Transformer.flatten(this.shippingAddress, 'shipping_address'));
    // add subscription fields
    Object.assign(params, Transformer.flatten(product.data, 'subscription'));
    // add affiliate token if present
    this.affiliateToken && (params['subscription[affiliate_token]'] = this.affiliateToken);

    if (product.isOneTimeCheckout) {
      return Urls['one_time_checkout_hosted_page'](params);
    }
    return product.isItemsModel
      ? Urls['item_specific_hosted_page'](params, null, domain, useBaseDomain)
      : Urls['plan_specific_hosted_page'](params, null, domain, useBaseDomain);
  }

  private static customerWithoutBillingAddress(customer: Customer) {
    return Object.keys(customer).reduce((prev, next) => {
      if (next != 'billing_address') {
        prev[next] = customer[next];
      }
      return prev;
    }, {});
  }
}
