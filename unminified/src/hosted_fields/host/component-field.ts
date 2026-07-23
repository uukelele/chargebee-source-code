import {
  AllowedListeners,
  ResponseInnerMessage,
  ComponentOptions,
  ActionInnerMessage,
  FieldStatus,
  Locale,
  FieldChangeEvent,
  MessageData,
  EventMessage,
  FieldOptions,
  Styles,
  ValidationErrorMessage,
  TestCard,
} from '@/hosted_fields/common/types';
import {
  Events,
  Field,
  Card,
  ComponentMountStatus,
  FieldState,
  HostedFields,
  Entity,
  EventKeys,
} from '@/hosted_fields/common/enums';
import {BaseComponentField, ComponentType, TestCardsHandlerInterface} from '@/hosted_fields/common/base-types';
import CardComponent from '@/hosted_fields/host/card-component';
import CbIframe from '@/hosted_fields/host/cb-iframe';
import {Master} from '@/hosted_fields/common/enums';
import {deepAssign, isEqual, toggleClass, isElement, has} from '@/hosted_fields/common/dom-utils';
import {sanitizeInput} from '@/hosted_fields/common/sanitizer';
import {DefaultLocale} from '../common/locale';
import Errors, {CbError, Warn, ValidationError} from '@/hosted_fields/common/errors';
import ComponentRegistrar from '@/hosted_fields/host/component-registrar';
import Helpers from '@/helpers';
import ErrorCodes from '@/hosted_fields/common/errors';
import IframeClientLoader from './iframe-client-loader';
import Ids from '@/constants/ids';
import Logger from '@/utils/logger_old';
import {setLocaleText} from '@/hosted_fields/common/locale';
import {debugMode} from '@/constants/environment';
import TestCards from './test-cards';
import cbIframeClient from './cb-iframe-client';

const {CSSClass} = HostedFields;

const helpers = {
  sendMessage(action: Master.Actions, field: CardField): Promise<ResponseInnerMessage> {
    const payload: MessageData = {
      // Component data
      componentName: field.parent.name,
      type: ComponentType.Card,
      baseOptions: this.getComponentOptions(field.parent),
      fonts: field.parent.fonts || [],
      // Field data
      name: field.cbIframe.ref.name,
      fieldType: field.fieldType,
      frame: field.cbIframe.ref.name,
      options: this.getFieldOptions(field),
      metadata: Helpers.getSiteMetaData(),
    };
    let actionMessage: ActionInnerMessage = {
      action,
      data: payload,
    };
    return IframeClientLoader.then((cbIframeClient) => cbIframeClient.send(actionMessage, Ids.MASTER_FRAME));
  },

  getFieldOptions(field: CardField): FieldOptions {
    return field.options || {};
  },

  getComponentOptions(parent: CardComponent): ComponentOptions {
    return parent.options || {};
  },

  getFieldFromFieldType(fieldType: Card.ComponentFieldType): Field | '' {
    switch (fieldType) {
      case Card.ComponentFieldType.Number:
        return Field.Number;
      case Card.ComponentFieldType.Expiry:
        return Field.Expiry;
      case Card.ComponentFieldType.CVV:
        return Field.CVV;
      default:
        return '';
    }
  },

  validateOptions(options: FieldOptions) {
    sanitizeInput<FieldOptions>(options, Entity.field);
  },

  getLocale(field: CardField): Locale {
    const componentOptions = field.parent.options;
    return (componentOptions[HostedFields.Options.locale] as Locale) || DefaultLocale;
  },

  /** MESSAGE SENDERS */
  updateStyles(style: Styles, frameId: string) {
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: Master.Actions.UpdateStyles,
          data: {
            style,
            frameId,
            entity: Entity.field,
          },
        },
        Ids.MASTER_FRAME
      )
    );
  },

  updatePlaceholder(placeholder: string, frameId: string) {
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: Master.Actions.UpdatePlaceholder,
          data: {
            placeholder,
            frameId,
            entity: Entity.field,
          },
        },
        Ids.MASTER_FRAME
      )
    );
  },

  updateAriaLabel(ariaLabel: string, frameId: string) {
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: Master.Actions.UpdateAriaLabel,
          data: {
            ariaLabel,
            frameId,
            entity: Entity.field,
          },
        },
        Ids.MASTER_FRAME
      )
    );
  },

  log(data: any, extraData = {}) {
    Logger.sendLog(data, {
      ...extraData,
      ...Helpers.getSiteMetaData(),
    });
    // IframeClientLoader.then(cbIframeClient => cbIframeClient.send({
    //   action: Master.Actions.CaptureKVL,
    //   data: {
    //     ...data,
    //     ...extraData,
    //   }
    // }, Ids.MASTER_FRAME));
  },
};

export default class CardField implements BaseComponentField {
  // Field Mounting status
  mountStatus: ComponentMountStatus = ComponentMountStatus.Created;
  // Field's current state
  status: FieldStatus;
  fieldType: Card.ComponentFieldType;
  id: string;
  parent: CardComponent;
  cbIframe: CbIframe;
  private frameId: string;
  container: HTMLElement;
  options: FieldOptions;
  focused: boolean;
  listeners: {
    focus?: Function;
    blur?: Function;
    change?: Function;
    ready?: Function;
  };
  // Card-component's on change
  private componentOnChange: Function;
  private testCardsHandler: TestCardsHandlerInterface;

  constructor(fieldType: Card.ComponentFieldType, component: CardComponent, fieldOptions?: FieldOptions) {
    this.status = {
      isComplete: false,
      isValid: false,
      isInvalid: false,
      isEmpty: true,
      cardType: undefined,
      error: '',
      forceValidation: false,
    };
    this.fieldType = fieldType;
    this.parent = component;
    this.options = fieldOptions;
    this.listeners = {};
    this.focused = false;
    this.initializeTestCards();
  }

  private async initializeTestCards() {
    if (
      !this.parent.options.showTestCards ||
      ![Card.ComponentFieldType.Number, Card.ComponentFieldType.Combined].includes(this.fieldType)
    ) {
      return;
    }
    this.testCardsHandler = new TestCards();
  }

  at(domElement: string | HTMLElement): CardField {
    if (typeof domElement === 'string') {
      this.container = document.querySelector(domElement);
    } else if (isElement(domElement)) {
      this.container = domElement;
      domElement.id = domElement.id || Helpers.genUuid();
    }

    if (!this.container || !isElement(this.container)) {
      const err = new CbError(Errors.noContainerElement, {
        field: this.fieldType,
        entity: Entity.field,
      });
      throw err;
    }

    this.id = this.container.id;
    this.container.addEventListener('click', (e) => {
      if (this.mountStatus == ComponentMountStatus.Mounted) {
        this.focus();
      }
    });

    return this;
  }

  private triggerUpdate(option: HostedFields.Options) {
    switch (option) {
      case HostedFields.Options.style: {
        helpers.updateStyles(this.options[HostedFields.Options.style], this.frameId);
        break;
      }
      case HostedFields.Options.placeholder: {
        helpers.updatePlaceholder(this.options[HostedFields.Options.placeholder], this.frameId);
        break;
      }
      case HostedFields.Options.ariaLabel: {
        helpers.updateAriaLabel(this.options[HostedFields.Options.ariaLabel], this.frameId);
        break;
      }
    }
  }

  private hasChanged(prevOptions: FieldOptions, option: HostedFields.Options): boolean {
    const prev: any = prevOptions[option];
    const current: any = this.options[option];
    return !isEqual(prev, current);
  }

  update(fieldOptions: FieldOptions) {
    const prevOptions = this.options;
    this.options = deepAssign({}, this.options, fieldOptions);

    // Sanitize input options
    helpers.validateOptions(this.options);

    if (this.isMounted()) {
      Object.keys(this.options).map((option: HostedFields.Options) => {
        if (this.hasChanged(prevOptions, option)) {
          this.triggerUpdate(option);
        }
      });
    }
    return this;
  }

  isMounted() {
    const isMounted = this.mountStatus === ComponentMountStatus.Mounted;
    if (!isMounted) Warn(Errors.componentNotMounted);
    return isMounted;
  }

  focus() {
    if (this.isMounted()) {
      helpers.sendMessage(Master.Actions.Focus, this);
    }
  }

  blur() {
    if (this.isMounted()) {
      helpers.sendMessage(Master.Actions.Blur, this);
    }
  }

  clear() {
    if (this.isMounted()) {
      helpers.sendMessage(Master.Actions.Clear, this);
    }
  }

  /* Register user's event listeners */
  on(eventType: Events, eventCallback: Function) {
    if (eventCallback) {
      if (has(AllowedListeners, eventType) && typeof eventCallback === 'function') {
        this.listeners[eventType] = eventCallback;
      } else {
        throw new CbError(Errors.invalidListener, {listener: eventType});
      }
    }
    return this;
  }

  mount(domElement?: string | HTMLElement): Promise<boolean> {
    if (domElement) {
      this.at(domElement);
    }

    if (!this.container) {
      throw new CbError(ErrorCodes.noContainerElement, {
        field: this.fieldType,
        entity: Entity.field,
      });
    }
    // TODO throw error if parent is not mounted
    // TODO check if id is unique
    this.mountStatus = ComponentMountStatus.Mounting;
    // !TODO Validate based on mount status
    return IframeClientLoader.then((cbIframeClient) => cbIframeClient.createCbFrame(this, this.container))
      .then((frame) => {
        this.cbIframe = frame;
        this.frameId = frame.ref.name;
        return this.register();
      })
      .then((resp) => {
        this.mountStatus = ComponentMountStatus.Mounted;
        // Trigger ready event
        this.triggerEventListeners(Events.ready);

        // Render test cards
        if (this.canShowTestCards()) {
          this.testCardsHandler.renderTestCards(this.container);
        }

        return true;
      })
      .catch((err) => {
        // console.error(err)
        helpers.log(err, {description: `${this.fieldType} field mount failed`});
        return Promise.reject(false);
        // if(!Helpers.isSPA()) return Promise.reject(err); // TODO Check if this is needed?
      });
  }

  private register() {
    // Register iframe
    ComponentRegistrar.register(this.parent, this.frameId);
    const payload: MessageData = {
      // Component data
      componentName: this.parent.name,
      type: ComponentType.Card,
      baseOptions: helpers.getComponentOptions(this.parent),
      fonts: this.parent.fonts || [],
      // Field data
      name: this.frameId,
      fieldType: this.fieldType,
      frame: this.frameId,
      options: helpers.getFieldOptions(this),
      metadata: Helpers.getSiteMetaData(),
    };
    const message: ActionInnerMessage = {
      action: Master.Actions.RegisterField,
      data: payload,
    };
    return IframeClientLoader.then((cbIframeClient) => cbIframeClient.register(message, this.cbIframe));
  }

  setComponentOnChange(callback: Function) {
    if (typeof callback === 'function') {
      this.componentOnChange = callback;
    }
  }

  destroy(): Promise<boolean> {
    if (this.cbIframe) {
      return this.cbIframe
        .destroy()
        .then(() => {
          IframeClientLoader.then((cbIframeClient) => cbIframeClient.deregister(this.cbIframe.name));
          return true;
        })
        .catch(() => false);
    }
    return Promise.resolve(false);
  }

  applyCSSClass() {
    // Substitute custom event classes
    const _classes = this.parent.options.classes || {};
    _classes[CSSClass.focus] = _classes[CSSClass.focus] || FieldState.focus;
    _classes[CSSClass.invalid] = _classes[CSSClass.invalid] || FieldState.invalid;
    _classes[CSSClass.complete] = _classes[CSSClass.complete] || FieldState.complete;
    _classes[CSSClass.empty] = _classes[CSSClass.empty] || FieldState.empty;

    let container = this.container;
    let status = this.status;

    if (container) {
      // !TODO check if polyfill is added
      toggleClass(container, _classes[CSSClass.focus], this.focused);
      toggleClass(container, _classes[CSSClass.invalid], status.isInvalid);
      toggleClass(container, _classes[CSSClass.complete], status.isComplete);
      toggleClass(container, _classes[CSSClass.empty], status.isEmpty);
    }
  }

  private triggerEventListeners(event: Events, key?: EventKeys) {
    const _status = this.status;
    if (this.listeners[event] && event === Events.ready) {
      this.listeners[event](this);
      return;
    }

    let error: ValidationErrorMessage = ValidationError(_status.error, helpers.getLocale(this));
    let data: FieldChangeEvent = {
      field: this.fieldType,
      type: event,
      key,
      complete: _status.isComplete,
      error,
      cardType: _status.cardType,
      empty: _status.isEmpty,
    };

    if (_status.binData) {
      data.binData = _status.binData;
    }

    if (this.listeners[event]) {
      this.listeners[event](data);
    }

    // Trigger on change @ component level
    if (event === Events.change && this.componentOnChange) {
      this.componentOnChange(data);
    }
  }

  private getBinDataFromStatus(status: FieldStatus) {
    if (status && status.binData) {
      return status.binData;
    }
  }

  private handleStatusChange(data: EventMessage) {
    let key = helpers.getFieldFromFieldType(this.fieldType);

    if (this.fieldType === Card.ComponentFieldType.Combined) {
      const _number: FieldStatus = data.status[Field.Number];
      const _expiry: FieldStatus = data.status[Field.Expiry];
      const _cvv: FieldStatus = data.status[Field.CVV];

      // Status consolidation of all fields
      const forceValidation = _number.forceValidation || _expiry.forceValidation || _cvv.forceValidation;
      this.status.forceValidation = forceValidation;
      this.status.isComplete = _number.isComplete && _expiry.isComplete && _cvv.isComplete;
      this.status.isValid = _number.isValid && _expiry.isValid && _cvv.isValid;
      this.status.isEmpty = _number.isEmpty && _expiry.isEmpty && _cvv.isEmpty;
      this.status.isInvalid =
        forceValidation || (!this.status.isEmpty && (!this.focused || this.status.isComplete))
          ? _number.isInvalid || _expiry.isInvalid || _cvv.isInvalid
          : false;
      this.status.error = _number.error || _expiry.error || _cvv.error;
      this.status.cardType = _number.cardType;
      this.status.binData = this.getBinDataFromStatus(_number);
    } else if (key) {
      // Setting field status
      const _status: FieldStatus = data.status[key];
      this.status.forceValidation = _status.forceValidation;
      this.status.isComplete = _status.isComplete;
      this.status.isValid = _status.isValid;
      this.status.isEmpty = _status.isEmpty;
      this.status.isInvalid =
        _status.forceValidation || (!_status.isEmpty && (!this.focused || _status.isComplete))
          ? _status.isInvalid
          : false;
      this.status.error = _status.error;
      if (_status.cardType) this.status.cardType = _status.cardType;
      this.status.binData = this.getBinDataFromStatus(_status);
    }
  }

  private handleTranslations(msg: EventMessage) {
    if (msg.data && msg.data.translations) {
      setLocaleText(msg.data.translations);
    }
  }

  private canShowTestCards(): boolean {
    return (
      (this.fieldType === Card.ComponentFieldType.Number || this.fieldType === Card.ComponentFieldType.Combined) &&
      this.testCardsHandler &&
      !!this.testCardsHandler.hasTestCards
    );
  }

  private handleBlur(data: EventMessage) {
    const status = this.status;
    this.focused = false;
    this.status.isInvalid = status.isEmpty ? false : !status.isComplete || (status.isComplete && !status.isValid);
  }

  private handleFocus(data: EventMessage) {
    this.focused = true;

    // Show test cards if applicable
    if (this.canShowTestCards()) {
      this.testCardsHandler.show();
    }
  }

  _handleEvent(data: EventMessage) {
    if (debugMode()) console.log('handling event @ ', this.fieldType, this.cbIframe.name, this.id, data);
    if (this.cbIframe.name === data.frame) {
      switch (data.event) {
        case Events.blur: {
          this.handleBlur(data);
          break;
        }
        case Events.focus: {
          this.handleFocus(data);
          break;
        }
        case Events.change: {
          this.handleStatusChange(data);
          break;
        }
        case Events.setTranslations: {
          this.handleTranslations(data);
          break;
        }
        case Events.setTestCards: {
          const testCards: TestCard[] = (data && data.data && data.data.testCards) || [];
          if (this.testCardsHandler && testCards.length > 0) {
            this.testCardsHandler.setTestCards(testCards, this.container, this.cbIframe, this.fieldType);
          }
          break;
        }
        case Events.keyPress: {
          if (data.key === 'Escape' && this.canShowTestCards() && this.testCardsHandler) {
            this.testCardsHandler.hide();
          }
          break;
        }
        case Events.error:
          break;
      }
    }

    this.applyCSSClass();
    this.triggerEventListeners(data.event, data.key);
    this.status.forceValidation = false;
  }

  getStatus(): FieldStatus {
    return this.status;
  }
}
