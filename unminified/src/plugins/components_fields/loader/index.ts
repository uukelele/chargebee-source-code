import ComponentFactory from '@/hosted_fields/host/component-factory';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {Master} from '@/hosted_fields/common/enums';
import {MASTER_IFRAME_NAME} from '@/hosted_fields/common/connection/client';
import {Component, ComponentType, CardComponentInterface} from '@/hosted_fields/common/base-types';
import ComponentsFieldsLoaderInterface from '@/plugins/components_fields/loader/interface';
import {Callbacks, AdditionalData} from '@/plugins/three_domain_secure/types';
import {PaymentIntent} from '@/extensions/three_domain_secure/common/types';
import PluginLoader from '@/plugins/core/loader';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import {ComponentOptions} from '@/hosted_fields/common/types';

declare var Chargebee;

export default class ComponentsAndFieldsLoader extends PluginLoader implements ComponentsFieldsLoaderInterface {
  createComponent(componentType: ComponentType = ComponentType.Card, options: ComponentOptions = {}): Component {
    const componentTypes = Object.keys(ComponentType).map((key) => ComponentType[key]);
    if (!~componentTypes.indexOf(componentType)) {
      throw new CbError(Errors.invalidComponentType, {componentType});
    }
    return ComponentFactory.create(componentType, options);
  }

  tokenize(component: CardComponentInterface | ComponentType.Bank, payload = {}): Promise<any> {
    if (component === ComponentType.Bank) {
      return IframeClientLoader.then((cbIframeClient) =>
        cbIframeClient.send(
          {
            action: Master.Actions.TokenizeBankData,
            data: {
              currency: payload['currency'],
              bankData: payload,
            },
          },
          MASTER_IFRAME_NAME
        )
      );
    }
    return (<CardComponentInterface>component).tokenize(payload);
  }

  authorizeWith3ds(
    component: CardComponentInterface,
    intent: PaymentIntent,
    additionalData: AdditionalData = {},
    callbacks: Callbacks = {}
  ): Promise<PaymentIntent> {
    return (<CardComponentInterface>component).authorizeWith3ds(intent, additionalData, callbacks);
  }
}

Chargebee.getInstance().componentLoader = new ComponentsAndFieldsLoader();
