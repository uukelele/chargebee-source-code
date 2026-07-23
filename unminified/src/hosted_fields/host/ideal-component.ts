import Assert from '@/helpers/asserts';
import ComponentField from '@/hosted_fields/host/component-field';
import Errors, {CbError, Warn} from '@/hosted_fields/common/errors';
import Helpers from '@/helpers';
import t from '@/hosted_fields/common/locale';
import {
  AllowedListeners,
  FontFace,
  ComponentOptions,
  ActionInnerMessage,
  EventMessage,
  FieldOptions,
  Styles,
  Placeholder,
  Locale,
  CbToken,
} from '@/hosted_fields/common/types';
import {Card, ComponentMountStatus, Entity, HostedFields, Events, IDeal} from '@/hosted_fields/common/enums';
import {ComponentType, ThreeDSHandler, IdealComponentInterface} from '@/hosted_fields/common/base-types';
import {Master} from '@/hosted_fields/common/enums';
import {
  getValuesOf,
  find,
  clone,
  deepAssign,
  isEqual,
  combineObjectArray,
  isElement,
  has,
} from '@/hosted_fields/common/dom-utils';
import Sanitizer, {sanitizeInput} from '@/hosted_fields/common/sanitizer';
import {PaymentInfo, PaymentIntent, AdditionalData, Callbacks} from '@/extensions/three_domain_secure/common/types';
import {jsonify} from '@/utils/utility-functions';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import Ids from '@/constants/ids';
import IDealField from './ideal-field';

const {Options} = HostedFields;
const COMBINED_FIELD = Card.ComponentFieldType.Combined;
const INDIVIDUAL_FIELDS = [Card.ComponentFieldType.CVV, Card.ComponentFieldType.Expiry, Card.ComponentFieldType.Number];
const ALL_FIELDS = INDIVIDUAL_FIELDS.concat([COMBINED_FIELD]);

// Validation & Error Handling helpers
const helpers = {
  validateField(registeredFields: Array<Card.ComponentFieldType>, fieldType: Card.ComponentFieldType) {
    // Check if field type is valid
    if (!has(ALL_FIELDS, fieldType)) {
      throw new CbError(Errors.invalidFieldType, {
        fieldType,
        componentType: ComponentType.Card,
      });
    }

    // Check if given field type is already registered
    if (has(registeredFields, fieldType)) {
      throw new CbError(Errors.fieldAlreadyExists, {fieldType});
    }

    // Check if field type is allowed
    if (
      // If field type is individual field but combined field already registered
      (has(registeredFields, COMBINED_FIELD) && has(INDIVIDUAL_FIELDS, fieldType)) ||
      // If field type is combined field but individual field already registered (vice-versa)
      (fieldType === COMBINED_FIELD && registeredFields.some((f) => has(INDIVIDUAL_FIELDS, f)))
    ) {
      throw new CbError(Errors.fieldNotAllowed, {fieldType});
    }
  },

  // Check integrity of the fields to be mounted
  checkFieldsIntegrity(registeredFields: Array<Card.ComponentFieldType>) {
    // Throw error if no fields registered
    if (registeredFields.length == 0) throw new CbError(Errors.noFieldsToMount);
    // Single field should be a Combined field
    else if (registeredFields.length == 1 && registeredFields[0] !== COMBINED_FIELD)
      throw new CbError(Errors.fieldNotAllowed, {
        fieldType: registeredFields[0],
      });
    else if (registeredFields.length == 1 && registeredFields[0] == COMBINED_FIELD) return;
    // Check if all individual fields are present
    else if (!INDIVIDUAL_FIELDS.every((field) => has(registeredFields, field))) {
      throw new CbError(Errors.missingFields, {
        componentType: ComponentType.Card,
      });
    }
  },

  generateComponentName(type: ComponentType): string {
    return `${type}-component-${Helpers.genUuid()}`;
  },

  /**
   * MESSAGE SENDERS
   */

  send(actionName: string, data: any) {
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: Master.Actions[actionName],
          data,
        },
        Ids.MASTER_FRAME
      )
    );
  },

  registerComponent(componentName: string, options?: ComponentOptions) {
    return this.send('RegisterComponent', {
      name: componentName,
      type: ComponentType.IDeal,
      options,
    });
  },

  whitelistFonts(fonts: FontFace[], componentName: string) {
    // Note: Sanitizations & Whitelisting done @ master
    return this.send('WhitelistFonts', {
      fonts,
      componentName,
    });
  },

  updateStyles(style: Styles, componentName: string) {
    return this.send('UpdateStyles', {
      style,
      componentName,
      entity: Entity.component,
    });
  },

  updatePlaceholder(placeholder: Placeholder, componentName: string) {
    return this.send('UpdatePlaceholder', {
      componentName,
      placeholder,
      entity: Entity.component,
    });
  },

  updateLocale(locale: Locale, componentName: string) {
    return this.send('UpdateLocale', {
      componentName,
      locale,
      entity: Entity.component,
    });
  },

  updateIcon(icon: boolean, componentName: string) {
    return this.send('UpdateIcon', {
      componentName,
      icon,
      entity: Entity.component,
    });
  },

  captureException(error: CbError, extraData?) {
    return this.send('CaptureException', {
      error: jsonify(error),
      extraData,
    });
  },

  log(data: any, extraData = {}) {
    this.send('CaptureKVL', {
      ...data,
      ...extraData,
    });
  },
};

export default class IDealComponent implements IdealComponentInterface {
  fields: IDealField[] = [];
  name: string;
  type: ComponentType.IDeal;
  status: ComponentMountStatus = ComponentMountStatus.Created;
  id: string;
  options: ComponentOptions;
  gatewayConfig: any;
  listeners: {
    focus?: Function;
    blur?: Function;
    change?: Function;
    ready?: Function;
  };
  fonts: FontFace[] = [];
  container: HTMLElement;
  selectedBank: any;

  constructor(componentOptions: ComponentOptions = {}) {
    // Store fonts for sanitization after getting whitelist
    this.fonts.push(...(componentOptions[Options.fonts] || []));

    if (this.fonts.length) {
      helpers.log({name: 'FontCustomization'}, {fonts: this.fonts});
    }

    let options: ComponentOptions = clone(componentOptions);
    this.name = helpers.generateComponentName(ComponentType.IDeal);

    delete options[Options.fonts];

    // Sanitize component options
    options = sanitizeInput<ComponentOptions>(options, Entity.component);

    this.options = options;
    this.listeners = {};

    // Register card component @ master
    helpers.registerComponent(this.name, options);
  }

  createField(fieldType: IDeal.ComponentFieldType, fieldOptions: FieldOptions = {}): IDealField {
    // const registeredFields: Array<Card.ComponentFieldType> = this.fields.map(field => field.fieldType);
    // helpers.validateField(registeredFields, fieldType);

    // Sanitize field level options
    const options: FieldOptions = sanitizeInput<FieldOptions>(fieldOptions, Entity.field);

    const field = new IDealField(fieldType, this, options);
    this.fields.push(field);

    // Set component level on change for individual fields
    if (this.listeners[Events.change]) {
      field.setComponentOnChange(this.listeners[Events.change]);
    }

    return field;
  }

  getFields() {
    return this.fields;
  }

  deregister(id) {
    this.fields = this.fields.filter((f) => f.id !== id);
  }

  at(domElement: string | HTMLElement): IDealComponent {
    if (typeof domElement === 'string') {
      this.container = <HTMLElement>document.querySelector(domElement);
    } else if (isElement(domElement)) {
      this.container = domElement;
      domElement.id = domElement.id || Helpers.genUuid();
    }

    if (!this.container || !isElement(this.container)) {
      throw new CbError(Errors.noContainerElement, {
        field: ComponentType.Card,
        entity: Entity.component,
      });
    }

    this.id = this.container.id;

    return this;
  }

  on(eventType: Events, eventCallback: Function) {
    if (eventCallback) {
      if (has(AllowedListeners, eventType) && typeof eventCallback === 'function') {
        this.listeners[eventType] = eventCallback;

        // If change event listener, attach listener to all fields
        if (eventType === Events.change) {
          this.fields.map((field) => field.setComponentOnChange(this.listeners[eventType]));
        }
      } else {
        throw new CbError(Errors.invalidListener, {listener: eventType});
      }
    }
    return this;
  }

  private attachListenersToCombinedField(field: IDealField) {
    let listeners = Object.keys(this.listeners);
    if (listeners.length) {
      listeners.map((event: Events) => {
        if (event !== Events.ready) {
          field.on(event, this.listeners[event]);
        }
      });
    }
  }

  private onReady() {
    let onReady = this.listeners[Events.ready];
    if (onReady) onReady(this);
  }

  private hasChanged(prevOptions: ComponentOptions, option: HostedFields.Options): boolean {
    const prev: any = prevOptions[option];
    const current: any = this.options[option];
    return !isEqual(prev, current);
  }

  private triggerUpdate(option: HostedFields.Options) {
    switch (option) {
      // case Options.icon: {
      //   Sanitizer[Options.icon](this.options[option], this.options)
      //   if(this.combinedField) {
      //     helpers.updateIcon(this.options[Options.icon], this.name);
      //   }
      //   break;
      // }
      case Options.classes: {
        // Reapply classnames for all fields registered under this component
        this.fields.map((field: IDealField) => field.applyCSSClass());
        break;
      }
      case Options.fonts: {
        // Update all fields registered under this component
        helpers.whitelistFonts(this.options[Options.fonts], this.name);
        break;
      }
      case Options.locale: {
        helpers.updateLocale(this.options[Options.locale] as Locale, this.name);
        break;
      }
      case Options.style: {
        // Update all fields registered under this component
        helpers.updateStyles(this.options[Options.style], this.name);
        break;
      }
      case Options.placeholder: {
        // Update all fields registered under this component
        helpers.updatePlaceholder(this.options[Options.placeholder], this.name);
        break;
      }
    }
  }

  focus() {
    // this.field.focus();
  }

  blur() {
    // this.field.blur();
  }

  clear() {
    // this.field.clear();
  }

  isMounted() {
    return this.status === ComponentMountStatus.Mounted;
  }

  update(options: ComponentOptions) {
    let updatedOptions = deepAssign({}, this.options, options);
    const prevOptions = this.options;

    this.options = updatedOptions;

    if (options[Options.fonts]) {
      this.fonts.push(...options[Options.fonts]);
    }

    delete this.options[Options.fonts];

    // Sanitize component options
    this.options = sanitizeInput<ComponentOptions>(this.options, Entity.component);

    if (this.isMounted()) {
      Object.keys(Options).map((option: HostedFields.Options) => {
        if (this.hasChanged(prevOptions, option)) {
          this.triggerUpdate(option);
        }
      });
    }
  }

  mount(domElement: string | HTMLElement): Promise<boolean> {
    if (domElement) {
      this.at(domElement);
    }

    // TODO - Shouldn't we throw error if tokenization is not supported for any gateway
    return new Promise((resolve, reject) => {
      switch (this.status) {
        case ComponentMountStatus.Created: {
          // A wrapper to set realtive positioning to hold the absolute positioned
          // bank list iframe
          const wrapper = document.createElement('div');
          wrapper.style.position = 'relative';
          this.container.appendChild(wrapper);

          if (this.fields.length == 0) {
            const selectField = this.createField(IDeal.ComponentFieldType.BankSelect);
            const listField = this.createField(IDeal.ComponentFieldType.BankList);
            // this.attachListenersToCombinedField(field);

            selectField.setComponentOnChange(this.onSelectedBankChange.bind(this));

            selectField.at(wrapper);
            listField.at(wrapper);
          }

          // const registeredFields: Array<Card.ComponentFieldType> = this.fields.map(field => field.fieldType);
          // // Check if all fields are present before mounting
          // helpers.checkFieldsIntegrity(registeredFields);

          this.status = ComponentMountStatus.Mounting;
          Promise.all(this.fields.map((field) => field.mount()))
            .then((values) => {
              // Update mounted status
              this.status = ComponentMountStatus.Mounted;

              // Trigger ready event
              this.onReady();
              return resolve(true);
            })
            .catch((err) => {
              helpers.captureException(new CbError(err), {
                description: 'IDeal component mount failed',
              });
              reject(false);
            });
          break;
        }
        case ComponentMountStatus.Mounting:
          Warn(Errors.componentMounting, {
            name: 'mount',
            component: ComponentType.Card,
          });
          return resolve(false);
        case ComponentMountStatus.Mounted:
          Warn(Errors.componentAlreadyMounted, {component: ComponentType.Card});
          return resolve(false);
      }
    });
  }

  onSelectedBankChange(data) {
    this.selectedBank = data.value;
  }

  getSelectedBank(): any {
    return this.selectedBank;
  }

  validateCardDetails(): Promise<boolean> {
    const message = {
      action: Master.Actions.Validate,
      data: {
        componentName: this.name,
      },
    };
    return IframeClientLoader.then((cbIframeClient) => cbIframeClient.send(message, Ids.MASTER_FRAME)).then(
      (data: Array<object>) => {
        let fieldValidationStatues = combineObjectArray(data);
        return getValuesOf(fieldValidationStatues).every((status) => status.isValid);
      }
    );
  }

  // TODO define proper type
  tokenize(data: any = {}) {
    return this.validateCardDetails().then((validationSuccess: boolean) => {
      if (validationSuccess) {
        const message: ActionInnerMessage = {
          action: Master.Actions.TokenizeCardData,
          data: {
            currency: this.options.currency,
            componentName: this.name,
            additionalData: data,
          },
        };
        // TODO sanitize the error messsages
        return IframeClientLoader.then((cbIframeClient) =>
          cbIframeClient.send(message, Ids.MASTER_FRAME, {timeout: 10000})
        );
      } else {
        const err = new CbError(Errors.validationFailed);
        helpers.captureException(err, {
          description: 'Validation failed on tokenization',
        });
        throw err;
      }
    });
  }

  authorizeWith3ds(
    paymentIntent: PaymentIntent,
    additionalData: AdditionalData = {},
    callbacks: Callbacks = {}
  ): Promise<PaymentIntent> {
    const cbInstance = Helpers.getCbInstance();
    var threeDSHandler: ThreeDSHandler;
    return cbInstance
      .load3DSHandler()
      .then((_threeDSHandler) => {
        threeDSHandler = _threeDSHandler;
        return this.tokenize(additionalData);
      })
      .then((_tokenObj) => {
        const tokenObj: CbToken = <CbToken>_tokenObj;
        const cbToken: string = tokenObj.token;
        additionalData.vaultId = tokenObj.vaultToken;

        const paymentInfo: PaymentInfo = {
          cbToken,
          additionalData,
        };

        threeDSHandler.setPaymentIntent(paymentIntent, {});
        return threeDSHandler.handleCardPayment(paymentInfo, callbacks);
      });
  }

  framesCreated(): string[] {
    return this.fields.map((f) => f.cbIframe.ref.name);
  }

  delegateEvent(data: EventMessage) {
    const frameName = data.frame;
    const field: ComponentField = find(this.fields, (f) => f.cbIframe.ref.name === frameName);
    Assert.notTrue(() => !!field, t(Errors.frameNotSpecified));
    if (field) {
      field._handleEvent(data);
    }
  }

  destroy() {
    return Promise.all(this.fields.map((field: IDealField) => field.destroy()))
      .then(() => {
        this.fields = [];
      })
      .catch((error) => {
        const err = new CbError(error);
        helpers.log(err, {description: 'ideal component on destroy error'});
        throw err;
      });
  }
}
