import {ResponseInnerMessage, ActionInnerMessage, ReplyMessageOptions} from '@/hosted_fields/common/types';
import CbIframe, {CbIframeElement} from '@/hosted_fields/host/cb-iframe';
import Helpers from '@/helpers/index';
import Client, {MASTER_IFRAME_NAME} from '@/hosted_fields/common/connection/client';
import {Master} from '@/hosted_fields/common/enums';
import {WindowType} from '@/hosted_fields/common/enums';
import Receiver from '@/hosted_fields/common/connection/receiver';
import hostActions from '@/hosted_fields/host/host-actions';
import ComponentField from '@/hosted_fields/host/component-field';
import t from '@/hosted_fields/common/locale';
import ErrorCodes from '@/hosted_fields/common/errors';
import IDealField from './ideal-field';
import {MasterInitOptions} from '@/interfaces/cb-instance-options';
import EnvConstants from '@/constants/environment';

export const CHILD_IFRAME_NAME = (name: string, id: string): string => `cb-component-${name}-${id}`;

const helpers = {
  hash(): string {
    return `#${encodeURIComponent(window.location.host)}`;
  },
};

export interface CbIframeClientInterface {
  createMasterFrame(): Promise<any>;

  createCbFrame(componentField: ComponentField, containerElement: HTMLElement): Promise<CbIframe>;

  register(message: ActionInnerMessage, frame: CbIframe): Promise<ResponseInnerMessage>;

  register(message: ActionInnerMessage, frame: CbIframe): Promise<ResponseInnerMessage>;

  send(message: ActionInnerMessage, name: string, options?: ReplyMessageOptions): Promise<ResponseInnerMessage>;

  listen(event: MessageEvent);

  deregister(name: string);
}

class CbIframeClient implements CbIframeClientInterface {
  private commMgrReady: Promise<any>;
  private masterFrame: CbIframe;
  private childFrames: CbIframe[] = [];
  private connectionClient: Client;

  constructor() {
    this.connectionClient = new Client(WindowType.Host, true);
    new Receiver(WindowType.Host);
    hostActions(this);
  }

  createMasterFrame(): Promise<any> {
    if (this.checkMasterInitialized()) return this.commMgrReady;

    let jsEnv = EnvConstants.ENVIRONMENT;
    let site = Helpers.getCbInstance().options.site;
    const url = new URL(`${EnvConstants.ASSET_PATH}/master.html`);
    url.searchParams.set('site', site);
    url.searchParams.set('env', jsEnv);
    if (jsEnv === 'predev' || jsEnv === 'predev1') {
      url.searchParams.set('domain', Helpers.getCbInstance().options.domain);
    }
    url.hash = helpers.hash();
    this.masterFrame = CbIframe.masterFrame(
      MASTER_IFRAME_NAME,
      // @ts-ignore
      url.toString()
    );
    this.commMgrReady = this.masterFrame
      .insert()
      .then(() => {
        const cbInstance = Helpers.getCbInstance();
        const payload: MasterInitOptions = {
          host: window.location.origin,
          site: cbInstance.site,
          publishableKey: cbInstance.publishableKey,
          businessEntityId: Helpers.getBusinessEntityId(),
          brandId: Helpers.getBrandId(),
          options: cbInstance.options,
          window_url: window.location.href,
        };
        // Registering HOST with master
        let message: ActionInnerMessage = {
          action: Master.Actions.RegisterMaster,
          data: payload,
        };
        return this.register(message, this.masterFrame);
      })
      .catch((error) => {
        this.masterFrame.initializeFailed(new Error(t(ErrorCodes.errorMountingMaster)));
        console.error(t(ErrorCodes.errorMountingMaster));
        if (error) console.error(error); // Cannot do sentry/splunk logs without master
      });

    return this.commMgrReady;
  }

  /**
   * replaces existing div element with the given id with a corresponding iframe element
   */
  createCbFrame(componentField: ComponentField, containerElement: HTMLElement): Promise<CbIframe> {
    const id = componentField.id;
    const type = componentField.fieldType;
    const options = componentField.options;
    let jsEnv = EnvConstants.ENVIRONMENT;
    let site = Helpers.getCbInstance().options.site;
    const url = new URL(`${EnvConstants.ASSET_PATH}/component.html`);
    url.searchParams.set('site', site);
    url.searchParams.set('env', jsEnv);
    if (jsEnv === 'predev' || jsEnv === 'predev1') {
      url.searchParams.set('domain', Helpers.getCbInstance().options.domain);
    }
    url.hash = helpers.hash();
    const childFrame = CbIframe.componentFrame(
      CHILD_IFRAME_NAME.apply(null, [type, this.childFrames.length]),
      // @ts-ignore
      url.toString()
    );
    this.childFrames.push(childFrame);

    return (
      childFrame
        .insertInside(id, containerElement, componentField)
        // Wait for master frame to load
        .then(() => this.masterFrame.initialize)
        .then(() => childFrame)
    );
  }

  createIDealFrame(componentField: IDealField, containerElement: HTMLElement, opts: any): Promise<CbIframe> {
    const id = componentField.id;
    const type = componentField.fieldType;
    let jsEnv = EnvConstants.ENVIRONMENT;
    let site = Helpers.getCbInstance().options.site;
    const url = new URL(`${EnvConstants.ASSET_PATH}/component.html`);
    url.searchParams.set('site', site);
    url.searchParams.set('env', jsEnv);
    if (jsEnv === 'predev' || jsEnv === 'predev1') {
      url.searchParams.set('domain', Helpers.getCbInstance().options.domain);
    }
    url.hash = helpers.hash();
    const childFrame = CbIframe.componentFrame(
      CHILD_IFRAME_NAME.apply(null, [type, this.childFrames.length]),
      // @ts-ignore
      url.toString()
    );
    this.childFrames.push(childFrame);

    return (
      childFrame
        .insertInside(id, containerElement, componentField, opts)
        // Wait for master frame to load
        .then(() => this.masterFrame.initialize)
        .then(() => childFrame)
    );
  }

  /**
   * For registering a component/Field to Master
   * @param message - action message
   * @param name - iframe name
   */
  register(message: ActionInnerMessage, frame: CbIframe): Promise<ResponseInnerMessage> {
    // Wait for master iframe to load
    return this.masterFrame.iframeLoad
      .then(() =>
        this.connectionClient.sendMessage(message, MASTER_IFRAME_NAME, {
          timeout: 10000,
        })
      )
      .then(() => {
        frame.initializeSuccess();
        return {registered: true};
      })
      .catch((err) => {
        // if(!Helpers.isSPA()) { // TODO check if needed?
        frame.initializeFailed(err);
        // console.error(err);
        // }
        return {registered: false};
      });
  }

  private checkMasterInitialized() {
    const masterIframe: CbIframeElement = <HTMLIFrameElement>document.getElementById(MASTER_IFRAME_NAME);
    if (!this.masterFrame && masterIframe) this.masterFrame = masterIframe.instance;
    return !!this.masterFrame && !!masterIframe;
  }

  /**
   * Message communication with master
   * @param message - action message
   * @param name - iframe name
   * @param options - message Options
   */
  send(message: ActionInnerMessage, name: string, options?: ReplyMessageOptions): Promise<ResponseInnerMessage> {
    // Wait for master iframe to initialize
    return this.createMasterFrame()
      .then(() => this.masterFrame.initialize)
      .then(() => this.connectionClient.sendMessage(message, name, options));
  }

  listen(event: MessageEvent) {
    this.connectionClient.receiver.listen(event);
  }

  deregister(name: string) {
    this.childFrames = this.childFrames.filter((f) => f.name !== name);
  }
}

const cbIframeClient = new CbIframeClient();
export default cbIframeClient;
