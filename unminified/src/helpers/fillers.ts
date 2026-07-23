import {Customer, Address} from '@/interfaces/cb-types';
import {attrs, attrValue} from '@/helpers/polyfills';
export default class Fillers {
  static fillCustomer(element: HTMLElement) {}

  static fetchBasedOnResource(element: HTMLElement) {
    let output = {
      addons: {},
      customer: {},
      billing_address: {},
      shipping_address: {},
      subscription: {},
      subscription_items: {},
    };
    attrs(element).forEach((attribute) => {
      // TODO dry code
      if (attribute.startsWith('cbAddons')) {
        output['addons'][this.t(attribute)] = attrValue(element, attribute);
      } else if (attribute.startsWith('cbSubscription')) {
        output['subscription'][this.t(attribute)] = attrValue(element, attribute);
      } else if (attribute.startsWith('cbItem')) {
        output['subscription_items'][this.getItemAttribute(attribute)] = attrValue(element, attribute);
      }
    });
    return output;
  }

  static getItemAttribute(attribute: string): string {
    let o = attribute.replace(/([A-Z])/g, ($1) => '+' + $1.toLowerCase()).replace('cb+item-', '');
    if (o) {
      const arr = o.split('+');
      const indexStr = arr[0] ? `[${arr[0]}]` : '';
      if (arr.length == 2) {
        const propertyStr = arr[1] ? `[${arr[1]}]` : '';
        return indexStr + propertyStr;
      } else if (arr.length == 1) {
        const propertyStr = '[item_price_id]';
        return indexStr + propertyStr;
      }
    }
    console.error(`wrong format`);
  }

  static t(attribute: string): string {
    // EBE regression is needed for subscription.
    let o = attribute.replace(/([A-Z])/g, ($1) => '_' + $1.toLowerCase()).replace('cb_', '');
    if (o.match(/(.*?)_(.*)_(.*[0-9])/)) {
      let tmp = o.match(/(.*?)_(.*)_(.*[0-9])/);
      return tmp[1] + '[' + tmp[2] + '][' + tmp[3] + ']';
    } else if (o.match(/(.*)_(.*)_(.*)/)) {
      let tmp = o.match(/(.*)_(.*)_(.*)/);
      return tmp[1] + '[' + tmp[2] + '][' + tmp[3] + ']';
    }
    return o;
  }

  static transformToObject(type: string, attributes: {}): Customer | Address {
    switch (type) {
      case 'customer':
      case 'billing_address':
      case 'shipping_address':
      case 'subscription':
        return this._transform(type, attributes);
      default:
        throw new Error('Type not implemented');
    }
  }

  private static _transform(type, attributes) {
    return (
      attributes[type] &&
      Object.keys(attributes[type]).reduce((prev, next) => {
        let strippedKey = this.stripKeyFromResource(type, next);
        prev[strippedKey] = attributes[type][next];
        return prev;
      }, {})
    );
  }

  private static stripKeyFromResource(resource, key) {
    let reg = new RegExp(`${resource}\\[(.*)\\]`);
    return key.match(reg) && key.match(reg).slice(1);
  }
}
