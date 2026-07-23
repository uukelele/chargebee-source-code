import {Address} from '@/plugins/three_domain_secure/types';
import {Field} from '@/hosted_fields/common/enums';

export default class Transformer {
  static flattenMulti(items, name) {
    if (!items) return {};
    return items.reduce((o, item, index) => {
      Object.keys(item)
        .filter((i) => ['id', 'quantity', 'quantity_in_decimal', 'item_price_id', 'item_type'].indexOf(i) > -1)
        .forEach((keyName) => {
          o[`${name}[${keyName}][${index}]`] = item[keyName];
        });
      return o;
    }, {});
  }

  static flattenArray(items, name) {
    if (!items) return {};
    return items.reduce((o, item, index) => {
      Object.keys(item).forEach((keyName) => {
        o[`${name}[${keyName}][${index}]`] = item[keyName];
      });
      return o;
    }, {});
  }

  static flatten(data, name) {
    if (!data) return {};
    return Object.keys(data).reduce((o, key) => {
      if (data[key]) {
        o[`${name}[${key}]`] = data[key];
      }
      return o;
    }, {});
  }

  static fullName(fn: String, ln: String): String {
    if (fn && ln) {
      return `${fn} ${ln}`;
    } else if (fn) {
      return fn;
    } else if (ln) {
      return ln;
    }
    return undefined;
  }

  static clean(data) {
    if (!data) return {};
    return Object.keys(data).reduce((o, key) => {
      if (typeof data[key] != 'undefined' && typeof data[key] != 'function' && data[key] !== '') {
        if (typeof data[key] == 'object') {
          o[key] = Transformer.clean(data[key]);
        } else {
          o[key] = data[key];
        }
      }
      return o;
    }, {});
  }

  static billingAddress(data: any): Address {
    if (data.cardBillingAddress || data.billingAddress) data = data.cardBillingAddress || data.billingAddress;
    let addr: Address = {
      firstName: data[Field.FIRST_NAME],
      lastName: data[Field.LAST_NAME],
      phone: data[Field.BILLING_PHONE],
      addressLine1: data[Field.BILLING_ADDR1] || data[Field.BILLING_ADDRESS_LINE1],
      addressLine2: data[Field.BILLING_ADDR2] || data[Field.BILLING_ADDRESS_LINE2],
      addressLine3: data[Field.BILLING_ADDRESS_LINE3],
      city: data[Field.BILLING_CITY] || data[Field.BILLING_CITY2],
      state: data[Field.BILLING_STATE] || data[Field.BILLING_STATE2],
      stateCode: data[Field.BILLING_STATECODE] || data[Field.BILLING_STATE_CODE],
      countryCode: data[Field.BILLING_COUNTRY] || data[Field.BILLING_COUNTRYCODE],
      zip: data[Field.BILLING_ZIP] || data[Field.BILLING_ZIPCODE],
    };

    // Remove undefined
    addr = Object.keys(addr).reduce((obj, key) => {
      if (typeof addr[key] == 'string') return {...obj, [key]: addr[key]};
      return obj;
    }, {});

    return addr;
  }
}
