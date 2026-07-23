import Ids from '@/constants/ids';
import ComponentField from '@/hosted_fields/host/component-field';
import {WindowType} from '@/hosted_fields/common/enums';
import IDealField from './ideal-field';
import Helpers from '@/helpers';
import ErrorCodes from '@/hosted_fields/common/errors';
import RetryMechanism from '@/utils/retry-mechanism';
import t from '@/hosted_fields/common/locale';

export interface CbIframeElement extends HTMLIFrameElement {
  instance?: CbIframe;
}

export default class CbIframe {
  name: string;
  private type: WindowType;
  private srcUrl: string;
  loaded: boolean;
  public ref: HTMLIFrameElement;
  public componentField: ComponentField | IDealField;

  // Promise resolver for Loading
  iframeLoad: Promise<any>;
  private iframeLoadSuccess: Function;
  private iframeLoadFailed: Function;

  initialize: Promise<any>;
  initializeSuccess: Function;
  initializeFailed: Function;

  protected MASTER_IFRAME_TIMEOUT: number = 10000;
  protected MAX_RETRIES_MASTER_IFRAME = 3;

  constructor() {
    this.iframeLoad = new Promise((resolve, reject) => {
      this.iframeLoadSuccess = resolve;
      this.iframeLoadFailed = reject;
    });

    this.initialize = new Promise((resolve, reject) => {
      this.initializeSuccess = resolve;
      this.initializeFailed = reject;
    });
  }

  static masterFrame(name: string, srcUrl: string): CbIframe {
    const cbFrame = new CbIframe();
    cbFrame.name = name;
    cbFrame.type = WindowType.Master;
    cbFrame.srcUrl = srcUrl;
    return cbFrame;
  }

  static componentFrame(name: string, srcUrl: string): CbIframe {
    const cbFrame = new CbIframe();
    cbFrame.name = name;
    cbFrame.type = WindowType.Component;
    cbFrame.srcUrl = srcUrl;
    return cbFrame;
  }

  insertInside(id: string, container: HTMLElement, componentField?: ComponentField | IDealField, styles?: any) {
    const iframe: CbIframeElement = document.createElement('iframe');
    iframe.id = id;
    iframe.name = this.name;
    iframe.src = this.srcUrl;
    iframe.instance = this;

    const DEFAULT_HEIGHT = '1.2em';
    // Iframe default styles
    let frameStyles = {
      margin: '0',
      padding: '0',
      border: 'none',
      overflow: 'hidden',
      display: 'block',
      minWidth: '100%',
      width: '1px',
      height: DEFAULT_HEIGHT,
      ...styles,
    };
    Object.keys(frameStyles).forEach((prop) => {
      iframe.style[prop] = frameStyles[prop];
    });

    const existingElement = <HTMLDivElement>document.getElementById(id);

    if (!!componentField && existingElement) {
      iframe.id = iframe.id + '_frame';
      existingElement.classList.add('CbHosted');

      if (componentField && frameStyles.height === DEFAULT_HEIGHT) {
        componentField.container = existingElement;
        this.componentField = componentField;

        // Setting default height
        let _height = DEFAULT_HEIGHT;
        try {
          let fontSize = componentField.parent.options.style.base.fontSize;
          if (!!~fontSize.indexOf('px')) {
            let height = parseInt(fontSize.replace('px', '')) * 1.2 + 'px';
            _height = height || DEFAULT_HEIGHT;
          }
        } catch (e) {
          // set default height
        }
        iframe.style.height = _height;
      }

      existingElement.appendChild(iframe);
    } else {
      if (existingElement) {
        existingElement.remove();
      }
      container.insertBefore(iframe, null);
    }
    this.ref = iframe;

    return new Promise<boolean>((resolve, reject) => {
      const loadSuccess = () => {
        this.iframeLoadSuccess();
        resolve(true);
      };

      const loadFailure = () => {
        if (!Helpers.isSPA()) {
          const errorMessage = `${iframe.name} iframe load failed`;

          this.iframeLoadFailed(errorMessage);
          reject(errorMessage);
        }
      };

      iframe.onload = loadSuccess;
      iframe.onerror = loadFailure;
    });
  }

  insert() {
    let cbContainer = <HTMLDivElement>document.getElementById(Ids.CONTAINER);

    return new RetryMechanism(
      async () => {
        return await this.insertInside(this.name, cbContainer);
      },
      {
        errors: {
          executionTimeout: t(ErrorCodes.errorMountingMaster),
          maxAttemptsReached: t(ErrorCodes.errorMountingMaster),
        },
      }
    )
      .setExecutionTimeout(this.MASTER_IFRAME_TIMEOUT)
      .setMaxRetries(this.MAX_RETRIES_MASTER_IFRAME)
      .execute();
  }

  destroy(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        // Remove Iframe Contents & Delete from DOM
        this.ref.innerHTML = '';
        this.componentField.container.removeChild(this.ref);
        delete this.ref;
        delete this.componentField;
        resolve(true);
      } catch (error) {
        reject(false);
      }
    });
  }
}
