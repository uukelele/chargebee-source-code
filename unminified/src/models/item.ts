import Product from '@/models/product';

export default interface Item {
  item_price_id: string;
  quantity?: number;
  quantity_in_decimal?: string;
  item_type?: ItemType;

  setQuantity(quantity: number);
  setQuantityInDecimal(quantityInDecimal: string);
  setType(type: ItemType);
}

export function createItem(
  item_price_id: string,
  quantity?: number,
  quantity_in_decimal?: string,
  item_type?: ItemType
) {
  let item: Item = {
    item_price_id,

    setQuantity(quantity: number): Item {
      if (quantity) this.quantity = quantity;
      return this;
    },

    setQuantityInDecimal(quantityInDecimal: string): Item {
      if (quantityInDecimal) this.quantity_in_decimal = quantityInDecimal;
      return this;
    },

    setType(type: ItemType): Item {
      if (type) this.item_type = type;
      return this;
    },
  };

  item.setQuantity(quantity).setType(item_type).setQuantityInDecimal(quantity_in_decimal);
  return item;
}

export enum ItemType {
  PLAN = 'plan',
  ADDON = 'addon',
  CHARGE = 'charge',
}

export function setItemsForProduct(product: Product) {
  let items: Array<Item> = [];
  if (product.isItemsModel) {
    if (product.planId) {
      const planItem = createItem(product.planId, product.planQuantity, product.planQuantityInDecimal, ItemType.PLAN);
      items.push(planItem);
    }
    product.addons.map((addon) => {
      items.push(createItem(addon.id, addon.quantity, addon.quantity_in_decimal, ItemType.ADDON));
    });

    product.charges.map((charge) => {
      items.push(createItem(charge.id, charge.quantity, charge.quantity_in_decimal, ItemType.CHARGE));
    });

    product.items = items;
  }
}
