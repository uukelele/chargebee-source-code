import Assert from '@/helpers/asserts';
import ComponentField from '@/hosted_fields/host/component-field';
import Errors, {CbError, Warn} from '@/hosted_fields/common/errors';
import Helpers from '@/helpers';
import t from '@/hosted_fields/common/locale';
import {
  ActionInnerMessage,
  AllowedListeners,
  AriaLabel,
  BINData,
  CbToken,
  ComponentOptions,
  EventMessage,
  FieldOptions,
  FontFace,
  Locale,
  Placeholder,
  Styles,
} from '@/hosted_fields/common/types';
import {Card, ComponentMountStatus, Entity, Events, HostedFields, Master, Field} from '@/hosted_fields/common/enums';
import {CardComponentInterface, ComponentType, ThreeDSHandler} from '@/hosted_fields/common/base-types';
import {
  clone,
  combineObjectArray,
  deepAssign,
  find,
  getValuesOf,
  has,
  isElement,
  isEqual,
} from '@/hosted_fields/common/dom-utils';
import Sanitizer, {sanitizeInput} from '@/hosted_fields/common/sanitizer';
import {
  AdditionalData,
  Callbacks,
  Gateway,
  PaymentInfo,
  PaymentIntent,
  Orchestrator,
} from '@/extensions/three_domain_secure/common/types';
import {jsonify} from '@/utils/utility-functions';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import Ids from '@/constants/ids';
import {constructPaymentIntentApiPayload} from '@/internal/common/utils';

import FieldOption = HostedFields.FieldOption;

const {Options} = HostedFields;
const COMBINED_FIELD = Card.ComponentFieldType.Combined;
const INDIVIDUAL_FIELDS = [Card.ComponentFieldType.CVV, Card.ComponentFieldType.Expiry, Card.ComponentFieldType.Number];
const ALL_FIELDS = INDIVIDUAL_FIELDS.concat([COMBINED_FIELD]);

interface ValidationError {
  errorMsg: string;
  isValid: boolean;
}
// Validation & Error Handling helpers
const helpers = {
  validateField(
    registeredFields: Array<Card.ComponentFieldType>,
    allowedFields: Array<Card.ComponentFieldType>,
    fieldType: Card.ComponentFieldType
  ) {
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
      // If field type is not combined field and field is not present in allowed fields
      (fieldType !== COMBINED_FIELD && !has(allowedFields, fieldType)) ||
      // If field type is individual field but combined field already registered
      (has(registeredFields, COMBINED_FIELD) && has(INDIVIDUAL_FIELDS, fieldType)) ||
      // If field type is combined field but individual field already registered (vice-versa)
      (fieldType === COMBINED_FIELD && registeredFields.some((f) => has(INDIVIDUAL_FIELDS, f)))
    ) {
      throw new CbError(Errors.fieldNotAllowed, {
        fieldType,
        componentType: ComponentType.Card,
      });
    }
  },

  // Check integrity of the fields to be mounted
  checkFieldsIntegrity(
    registeredFields: Array<Card.ComponentFieldType>,
    requiredFields: Array<Card.ComponentFieldType>
  ) {
    // Throw error if no fields registered
    if (registeredFields.length == 0) throw new CbError(Errors.noFieldsToMount);
    // Single field should be a Combined field
    else if (registeredFields.length == 1 && registeredFields[0] !== COMBINED_FIELD)
      throw new CbError(Errors.fieldNotAllowed, {
        fieldType: registeredFields[0],
      });
    else if (registeredFields.length == 1 && registeredFields[0] == COMBINED_FIELD) return;
    else if (!requiredFields.every((field) => has(registeredFields, field))) {
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
      type: ComponentType.Card,
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

  updateAriaLabel(ariaLabel: AriaLabel, componentName: string) {
    return this.send('UpdateAriaLabel', {
      componentName,
      ariaLabel,
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

export default class CardComponent implements CardComponentInterface {
  fields: ComponentField[] = [];
  name: string;
  type: ComponentType.Card;
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
  combinedField: ComponentField;
  container: HTMLElement;
  threeDSHandler: ThreeDSHandler;

  constructor(componentOptions: ComponentOptions = {}) {
    // Store fonts for sanitization after getting whitelist
    this.fonts.push(...(componentOptions[Options.fonts] || []));

    if (this.fonts.length) {
      helpers.log({name: 'FontCustomization'}, {fonts: this.fonts});
    }

    let options: ComponentOptions = clone(componentOptions);
    this.name = helpers.generateComponentName(ComponentType.Card);

    delete options[Options.fonts];

    // Sanitize component options
    options = sanitizeInput<ComponentOptions>(options, Entity.component);

    this.options = options;
    this.listeners = {};

    // Register card component @ master
    helpers.registerComponent(this.name, options);
  }

  createField(fieldType: Card.ComponentFieldType, fieldOptions: FieldOptions = {}): ComponentField {
    // Commenting below line to support React 18 Strict mode
    // Ref: https://reactjs.org/docs/strict-mode.html#ensuring-reusable-state
    // Jira: CHKOUTENGG-26251
    // const registeredFields: Array<Card.ComponentFieldType> = this.fields.map(field => field.fieldType);
    // const allowedFields: Array<Card.ComponentFieldType> = INDIVIDUAL_FIELDS.filter(field => this.options.field[field] && this.options.field[field][FieldOption.show]);
    // helpers.validateField(registeredFields, allowedFields, fieldType);

    // Sanitize field level options
    const options: FieldOptions = sanitizeInput<FieldOptions>(fieldOptions, Entity.field);

    const field = new ComponentField(fieldType, this, options);
    this.fields.push(field);

    // Set component level on change for individual fields
    if (this.listeners[Events.change]) {
      field.setComponentOnChange(this.listeners[Events.change]);
    }

    // For individual mode
    if (this.listeners[Events.keyPress]) {
      field.on(Events.keyPress, this.listeners[Events.keyPress]);
    }

    return field;
  }

  getFields() {
    return this.fields;
  }

  deregister(id) {
    this.fields = this.fields.filter((f) => f.id !== id);
  }

  at(domElement: string | HTMLElement): CardComponent {
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

  private attachListenersToCombinedField(field: ComponentField) {
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
      case Options.icon: {
        Sanitizer[Options.icon](this.options[option], this.options);
        if (this.combinedField) {
          helpers.updateIcon(this.options[Options.icon], this.name);
        }
        break;
      }
      case Options.classes: {
        // Reapply classnames for all fields registered under this component
        this.fields.map((field: ComponentField) => field.applyCSSClass());
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
      case Options.ariaLabel: {
        // Update all fields registered under this component
        helpers.updateAriaLabel(this.options[Options.ariaLabel], this.name);
        break;
      }
    }
  }

  focus() {
    if (this.combinedField) {
      this.combinedField.focus();
      return;
    } else if (this.fields.length) {
      // On individual fields, focus the first element
      const field = this.fields[0];
      field.focus();
    }
  }

  blur() {
    if (this.combinedField) {
      this.combinedField.blur();
      return;
    }
  }

  clear() {
    if (this.combinedField) {
      this.combinedField.clear();
      return;
    }
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
          // Create a combined field (if no fields are specified)
          if (this.fields.length == 0) {
            const field = this.createField(Card.ComponentFieldType.Combined);
            this.attachListenersToCombinedField(field);
            field.at(this.container);
            helpers.log({mode: 'combined'});
            this.combinedField = field;
          } else {
            helpers.log({mode: 'individual'});
          }

          const registeredFields: Array<Card.ComponentFieldType> = this.fields.map((field) => field.fieldType);
          const requiredFields: Array<Card.ComponentFieldType> = INDIVIDUAL_FIELDS.filter(
            (field) => this.options.field[field] && this.options.field[field][FieldOption.required]
          );
          // Check if all fields are present before mounting
          helpers.checkFieldsIntegrity(registeredFields, requiredFields);

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
                description: 'Card component mount failed',
              });
              if (!Helpers.isSPA()) reject(err);
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

  getErrorMsgForEmptyvalue(field) {
    switch (field) {
      case Field.Number:
        return 'error.validation.invalidCard';
      case Field.CVV:
        return 'error.validation.cardCvvInvalid';
      case Field.Expiry:
        return 'error.validation.cardExpiryInvalid';
      default:
        return Errors.validationFailed;
    }
  }

  filterCardData(fieldValidationStatues): ValidationError {
    let isValid = true;
    let invalid_fields = {};
    let errorMsg = '';
    for (const field in fieldValidationStatues) {
      const data = fieldValidationStatues[field];
      if (!data.isValid) {
        let error = data.error;
        if (data.isEmpty) {
          error = this.getErrorMsgForEmptyvalue(field);
        }
        invalid_fields[field] = error;
        // We will set only first error as error msg
        if (!errorMsg) errorMsg = error;
        isValid = false;
      }
    }
    if (!isValid) {
      helpers.log({
        action: 'tokenization_card_fields_validation_failed',
        invalid_fields: JSON.stringify(invalid_fields),
        resp_status: 'error',
      });
    }
    return {
      isValid,
      errorMsg,
    };
  }

  validateCardDetails(): Promise<boolean> {
    return this.isValidCardDetails().then((validationSuccess: ValidationError) => {
      return validationSuccess.isValid;
    });
  }

  private isValidCardDetails(): Promise<ValidationError> {
    const message = {
      action: Master.Actions.Validate,
      data: {
        componentName: this.name,
      },
    };
    return IframeClientLoader.then((cbIframeClient) => cbIframeClient.send(message, Ids.MASTER_FRAME)).then(
      (data: Array<object>) => {
        let fieldValidationStatues = combineObjectArray(data);
        return this.filterCardData(fieldValidationStatues);
      }
    );
  }

  private fetchGatewayCredential(paymentIntent: PaymentIntent): Promise<any> {
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: Master.Actions.FetchGatewayCredential,
          data: constructPaymentIntentApiPayload(paymentIntent),
        },
        Ids.MASTER_FRAME,
        {timeout: 10000}
      )
    );
  }

  private isCardComponentSupported(paymentIntent) {
    return new Promise((resolve) => {
      // we don't support for this gateway
      if (
        [
          Gateway.STRIPE,
          Gateway.BLUESNAP,
          Gateway.BRAINTREE,
          Gateway.ECENTRIC,
          Gateway.METRICS_GLOBAL,
          Gateway.WINDCAVE,
          Gateway.DLOCAL,
          Gateway.Nuvei,
        ].includes(paymentIntent.gateway)
      ) {
        return resolve(false);
      } else if (
        // we support for this gateway
        [
          Gateway.ADYEN,
          Gateway.BANK_OF_AMERICA,
          Gateway.CHARGEBEE_PAYMENTS,
          Gateway.CHECKOUT_COM,
          Gateway.CYBERSOURCE,
          Gateway.EBANX,
          Gateway.GLOBAL_PAYMENTS,
          Gateway.INGENICO_DIRECT,
          Gateway.MOLLIE,
          Gateway.PAYCOM,
          Gateway.RAZORPAY,
          Gateway.VANTIV,
          Gateway.WORLDPAY,
          Gateway.SOLIDGATE,
        ].includes(paymentIntent.gateway)
      ) {
        return resolve(true);
      } else {
        // if not in above list then check payfurl
        this.fetchGatewayCredential(paymentIntent).then((gatewayCredential) => {
          return resolve(gatewayCredential.integration_name !== Orchestrator.PAYFURL);
        });
      }
    });
  }

  // TODO define proper type
  tokenize(data: any = {}) {
    return this.isValidCardDetails().then((validationSuccess: ValidationError) => {
      if (validationSuccess.isValid) {
        const message: ActionInnerMessage = {
          action: Master.Actions.TokenizeCardData,
          data: {
            currency: this.options.currency,
            componentName: this.name,
            additionalData: data,
          },
        };
        // TODO sanitize the error messsages
        return IframeClientLoader.then(
          (cbIframeClient) => cbIframeClient.send(message, Ids.MASTER_FRAME, {timeout: 300000}) // 5 minutes timeout
        );
      } else {
        const err = new CbError(
          validationSuccess.errorMsg || Errors.validationFailed,
          undefined,
          this.options[Options.locale]
        );
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
    if (paymentIntent) this.options.currency = paymentIntent.currency_code;
    return Promise.all([cbInstance.load3DSHandler(), this.isCardComponentSupported(paymentIntent)])
      .then(([_threeDSHandler, cardComponentSupported]) => {
        this.threeDSHandler = _threeDSHandler;
        if (cardComponentSupported) {
          return {
            cardComponent: this.name,
          };
        }

        helpers.log({action: 'authorizeWith3ds_tokenize'}, {gateway: paymentIntent.gateway});
        return this.tokenize({
          paymentIntent,
          ...additionalData,
        });
      })
      .then((_tokenObj: any) => {
        const tokenObj: CbToken = <CbToken>_tokenObj;
        const cbToken: string = tokenObj.token;
        additionalData.vaultId = tokenObj.vaultToken;
        additionalData.additionalInformation = tokenObj.additional_information;

        const paymentInfo: PaymentInfo = {
          cbToken,
          additionalData,
        };

        let preCheck: Promise<any> = Promise.resolve();
        if (_tokenObj.cardComponent) {
          paymentInfo.cardComponent = _tokenObj.cardComponent;
          preCheck = this.validateCardDetails().then((isValid) => {
            if (isValid) return true;
            else {
              const err = new CbError(Errors.validationFailed);
              helpers.captureException(err, {
                description: 'Card Validation failed',
              });
              throw err;
            }
          });
        }

        this.threeDSHandler.setPaymentIntent(paymentIntent, {});
        return preCheck.then(() => this.threeDSHandler.handleCardPayment(paymentInfo, callbacks));
      });
  }

  get3DSHandler(): ThreeDSHandler {
    if (this.threeDSHandler) {
      return this.threeDSHandler;
    }
    throw new CbError('3D Secure payment handler not initialized');
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

  getBinData(): BINData | undefined {
    let field: ComponentField;
    if (this.combinedField) {
      field = this.combinedField;
    } else {
      const numberField = this.fields.find((field) => field.fieldType === Card.ComponentFieldType.Number);
      if (numberField) {
        field = numberField;
      }
    }
    if (field) {
      const fieldStatus = field.getStatus();
      const binData = fieldStatus.binData;
      if (binData) {
        if (fieldStatus && fieldStatus.cardType) {
          binData.brand = fieldStatus.cardType;
        }
        return binData;
      }
    }
  }

  destroy() {
    return Promise.all(this.fields.map((field: ComponentField) => field.destroy()))
      .catch((error) => {
        const err = new CbError(error);
        helpers.log(err, {description: 'card component on destroy error'});
      })
      .finally(() => {
        this.fields = [];
      });
  }
}
