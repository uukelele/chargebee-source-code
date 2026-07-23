import {Component, ComponentType} from '@/hosted_fields/common/base-types';
import CardComponent from '@/hosted_fields/host/card-component';
import IDealComponent from '@/hosted_fields/host/ideal-component';
import {ComponentOptions} from '@/hosted_fields/common/types';

export default class ComponentFactory {
  static create(type: ComponentType, options: ComponentOptions): Component {
    switch (type) {
      case ComponentType.Card:
        return new CardComponent(options);
      case ComponentType.IDeal:
      /**
       * TODO: to refactor (renaming) IDealComponent into bank dropdown component
       * though the component is referred to as ideal, it doesn't have any specifics to ideal payment
       * hence reused for dotpay, faster_payments, pay_to & sepa_instant_transfer
       */
      case ComponentType.Dotpay:
      case ComponentType.SepaInstantTransfer:
      case ComponentType.PayTo:
      case ComponentType.FasterPayments:
        return new IDealComponent(options);
    }
  }
}
