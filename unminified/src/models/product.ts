import Assert from '@/helpers/asserts';
import Addon from '@/models/addon';
import Charge from '@/models/addon';
import Item, {ItemType, createItem} from '@/models/item';
import Cart from '@/models/cart';
import Fillers from '@/helpers/fillers';
import {attrs, attrValue} from '@/helpers/polyfills';
import {Layout} from '@/constants/enums';
import {getValuesOf} from '@/hosted_fields/common/dom-utils';

// TODO DRY methods
export default class Product {
  planId: string;
  planQuantity: number;
  planQuantityInDecimal: string;
  addons: Array<Addon> = [];
  coupons: Array<string> = [];
  charges: Array<Charge> = [];
  items: Array<Item> = [];
  isItemsModel: boolean;
  isOneTimeCheckout: boolean;
  layout: Layout;
  data: {} = {};

  constructor(planId: string, planQuantity?: number, isItemsModel?: boolean) {
    this.planId = planId;
    this.planQuantity = planQuantity;
    this.isItemsModel = isItemsModel;
  }

  setIsItemsModel(isItemsModel: boolean) {
    this.isItemsModel = isItemsModel;
  }

  setLayout(layout: Layout) {
    this.layout = layout as Layout;
  }

  setPlanQuantity(planQuantity?: number) {
    this.planQuantity = planQuantity;
    return this;
  }

  setPlanQuantityInDecimal(planQuantityInDecimal: string) {
    this.planQuantityInDecimal = planQuantityInDecimal;
    return this;
  }

  setAddons(addons: Array<Addon>) {
    this.addons = addons;
    return this;
  }

  setCharges(charges: Array<Charge>) {
    this.charges = charges;
    return this;
  }

  incrementPlanQuantity(): Product {
    Assert.notTrue(() => !!this.planId, 'PlanId should be present');
    if (!this.planQuantity) {
      this.planQuantity = 0;
    }
    this.planQuantity += 1;
    return this;
  }

  decrementPlanQuantity(): Product {
    if (this.planQuantity > 0) {
      this.planQuantity -= 1;
    }
    return this;
  }

  addAddon(addon: Addon | string): Product {
    if (typeof addon == 'string') {
      addon = {id: addon};
    }
    Assert.notTrue(
      () => this.addons.length == 0 || this.addons.some((i) => i.id != (<Addon>addon).id),
      'Only one addon with the same id can be present'
    );
    this.addons.push(addon);
    return this;
  }

  removeAddon(addon: Addon | string): Product {
    if (!addon) {
      throw new Error('addon object or addon id should be passed');
    }
    var addonId = typeof addon != 'string' ? addon.id : addon;
    let indexToBeDeleted = this.addons.map((a) => a.id).indexOf(addonId);
    if (indexToBeDeleted > -1) {
      this.addons.splice(indexToBeDeleted, 1);
    }
    return this;
  }

  addCharge(charge: Charge | string): Product {
    if (typeof charge == 'string') {
      charge = {id: charge};
    }
    Assert.notTrue(
      () => this.charges.length == 0 || this.charges.some((i) => i.id != (<Charge>charge).id),
      'Only one charge with the same id can be present'
    );
    this.charges.push(charge);
    return this;
  }

  removeCharge(charge: Charge | string): Product {
    if (!charge) {
      throw new Error('Charge object or charge id should be passed');
    }
    var chargeId = typeof charge != 'string' ? charge.id : charge;
    let indexToBeDeleted = this.charges.map((a) => a.id).indexOf(chargeId);
    if (indexToBeDeleted > -1) {
      this.charges.splice(indexToBeDeleted, 1);
    }
    return this;
  }

  incrementChargeQty(id: string): Product {
    let charge = this.charges.filter((charge) => charge.id == id)[0];
    Assert.notTrue(() => !!charge, 'No Charge with the given id is present');
    if (!charge.quantity) {
      charge.quantity = 0;
    }
    charge.quantity += 1;
    return this;
  }

  decrementChargeQty(id: string): Product {
    let charge = this.charges.filter((charge) => charge.id == id)[0];
    Assert.notTrue(() => !!charge, 'No Charge with the given id is present');
    if (charge.quantity > 0) {
      charge.quantity -= 1;
    }
    return this;
  }

  addCoupon(coupon: string): Product {
    this.coupons.push(coupon);
    return this;
  }

  setCustomData(data: {}): Product {
    Object.keys(data).forEach((k) => {
      this.data[k] = data[k];
    });
    return this;
  }

  removeCoupon(coupon?: string) {
    if (coupon) {
      let index = this.coupons.indexOf(coupon);
      if (index >= 0) {
        this.coupons.splice(index, 1);
      }
    } else {
      this.coupons = [];
    }
    return this;
  }

  incrementAddonQty(id: string): Product {
    let addon = this.addons.filter((addon) => addon.id == id)[0];
    Assert.notTrue(() => !!addon, 'No addon with the given id is present');
    if (!addon.quantity) {
      addon.quantity = 0;
    }
    addon.quantity += 1;
    return this;
  }

  decrementAddonQty(id: string): Product {
    let addon = this.addons.filter((addon) => addon.id == id)[0];
    Assert.notTrue(() => !!addon, 'No addon with the given id is present');
    if (addon.quantity > 0) {
      addon.quantity -= 1;
    }
    return this;
  }

  fillAddons(addonAttributes: {}): void {
    if (Object.keys(addonAttributes).length > 0) {
      let tmpMap = {};
      Object.keys(addonAttributes).forEach((key) => {
        let tmp = key.match(/addons\[(.*)\]\[(.*)\]/) && key.match(/addons\[(.*)\]\[(.*)\]/).slice(1);
        if (tmp && tmp.length == 2) {
          if (!tmpMap[tmp[1]]) {
            tmpMap[tmp[1]] = {};
            this.addons.push(tmpMap[tmp[1]]);
          }
          tmpMap[tmp[1]][tmp[0]] = addonAttributes[key];
        }
      });

      if (this.addons.length > 0) {
        Assert.notTrue(() => this.addons.every((a) => !!a.id), 'Id should be present for all addons');
      }
      this.addons.forEach((a) => {
        if (a.quantity) {
          a.quantity = parseInt('' + a.quantity);
        }
      });
    }
  }

  getItem(itemPriceId: string): Item {
    return this.items.find((item) => item.item_price_id == itemPriceId);
  }

  removeItem(itemPriceId: string) {
    if (itemPriceId) {
      this.items = this.items.filter((item) => item.item_price_id !== itemPriceId);
    }
  }

  createItem(itemPriceId: string, itemQuantity?: number, itemType?: ItemType, quantityInDecimal?: string) {
    return createItem(itemPriceId, itemQuantity, quantityInDecimal, itemType);
  }

  setItems(items: Array<Item>) {
    this.items = items;
  }

  addItem(item: Item) {
    if (item && item.item_price_id) {
      const index = this.items.findIndex((_item) => _item.item_price_id == item.item_price_id);
      if (index > -1) {
        this.items[index] = item;
      } else {
        this.items.push(item);
      }
    }
  }

  fillSubscriptionCustomFields(subscriptionAttrs: {}): void {
    this.data = Fillers.transformToObject('subscription', subscriptionAttrs);
  }

  fillItems(subscriptionItems: {}): void {
    if (Object.keys(subscriptionItems).length > 0) {
      let item = {};
      Object.keys(subscriptionItems).forEach((key) => {
        let [index, property] = key.match(/\[(.*)\]\[(.*)\]/) && key.match(/\[(.*)\]\[(.*)\]/).slice(1);
        if (index && property) {
          // Rename 'type' to 'item_type'
          if (property == 'type') property = 'item_type';

          if (!item[index]) {
            item[index] = {};
            this.items.push(item[index]);
          }
          item[index][property] = subscriptionItems[key];
        }
      });

      if (this.items.length > 0) {
        Assert.notTrue(() => this.items.every((item) => !!item.item_price_id), 'id should be present for all items');
      }

      this.items.forEach((item) => {
        if (item.quantity) {
          item.quantity = parseInt('' + item.quantity);
        }
      });
    }
  }

  static hasItemAttributes(element: HTMLElement): boolean {
    const attributes = attrs(element);
    for (let i = 0; i < attributes.length; i++) {
      let attribute = attributes[i];
      if (attribute.startsWith('cbItem')) return true;
    }
    return false;
  }

  static createProductFromElement(element: HTMLElement): Product {
    let planId;
    let product: Product;
    const isItemsModel = this.hasItemAttributes(element);
    if (isItemsModel) {
      product = new Product('');
      product.isItemsModel = true;
      const layout = attrValue(element, 'cbLayout');
      if (layout && getValuesOf(Layout).indexOf(layout) >= -1) {
        product.layout = layout as Layout;
      }
    } else {
      planId = attrValue(element, 'cbPlanId');
      // Assert.notTrue(() => planId != null, "Plan Id cannot be null"); // EBE
      product = new Product(planId);

      let planQuantity = attrValue(element, 'cbPlanQuantity');
      let planQuantityInDecimal = attrValue(element, 'cbPlanQuantityInDecimal');
      if (planQuantity) {
        product.planQuantity = parseInt(planQuantity);
      }
      if (planQuantityInDecimal) {
        product.planQuantityInDecimal = planQuantityInDecimal;
      }
    }

    let attributes = Fillers.fetchBasedOnResource(element);
    if (isItemsModel) {
      product.fillItems(attributes['subscription_items']);
    } else {
      product.fillAddons(attributes['addons']);
    }

    // coupon will be filled along with subscription custom fields
    product.fillSubscriptionCustomFields(attributes);
    return product;
  }

  getLayout(): Layout | undefined {
    return this.layout;
  }
}
