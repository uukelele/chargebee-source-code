import Helpers from '@/helpers/index';
import Assert from '@/helpers/asserts';
import {MessageHandler, WindowType} from '@/hosted_fields/common/enums';
import {CommunicationMessage, ActionInnerMessage} from '@/hosted_fields/common/types';
import actionHolder from '@/hosted_fields/common/holder';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import t from '@/hosted_fields/common/locale';
import {iframePostMessage, jsonify, jsonifyError, logTargetWindow, sendKVL} from '@/utils/utility-functions';
import Ids from '@/constants/ids';
import Logger from '@/utils/logger_old';
import {debugMode} from '@/constants/environment';

let eventMethod = window.addEventListener ? 'addEventListener' : 'attachEvent';
let eventer = window[eventMethod];
let messageEvent = eventMethod == 'attachEvent' ? 'onmessage' : 'message';

export default class Receiver {
  windowType: WindowType;
  constructor(windowType: WindowType) {
    this.windowType = windowType;
    this.listen();
    // TODO - whitelist domain from which messages can be received
  }

  listen() {
    eventer(messageEvent, (e: MessageEvent) => {
      if (debugMode()) console.log('message received', e.data);

      if (typeof e.data != 'object' || e.data == null) {
        return;
      }

      if (!e.data.cbEvent) {
        return;
      }

      // TODO handle only events from host and child
      const comMessage: CommunicationMessage = e.data;
      if (
        !(
          comMessage.targetWindowName == window.name ||
          (this.windowType == WindowType.Host && comMessage.targetWindowName == Ids.HOST_NAME)
        )
      ) {
        return;
      }

      // if receiver window is of component type, checks whether event is from same domain
      // TODO: to check if it is from master frame only
      if (this.windowType == WindowType.Component && !(e.origin == Helpers.getJSDomainIframeCommunication())) {
        return;
      }

      // if receiver window is of Master type, checks whether event is from same domain or from parent site
      if (
        this.windowType == WindowType.Master &&
        !(e.origin == Helpers.getJSDomainIframeCommunication() || e.source === window.parent)
      ) {
        return;
      }

      // !TODO refactor this - VIVEK
      // if(this.windowType == WindowType.Master && !(e.origin == (Helpers.getJSDomainIframeCommunication()))) {
      //   return;
      // }

      const replyId = comMessage.replyId;
      const replyWindowId = comMessage.srcWindowName;

      const message = <ActionInnerMessage>comMessage.message;
      // only respond to messages with actions;
      // TODO check if we can do it another way
      if (!message || !message.action) {
        return;
      }
      Assert.notTrue(
        () => (this.windowType == WindowType.Component ? comMessage.srcWindowName == Ids.MASTER_FRAME : true),
        t(Errors.receiveMessageError)
      );
      const handled = actionHolder.resolve(message);
      // Unknown action (e.g. fetchCardData in a Payment Component iframe that also
      // loaded Host Receiver) — do not reply; another listener may handle it.
      if (handled === undefined || typeof handled.then !== 'function') {
        sendKVL({
          error: 'Action not handled',
          error_data: jsonify(message),
        });
        return;
      }
      handled
        .then((data) => {
          if ((message.options && message.options.noReply) || comMessage.srcWindowName === comMessage.targetWindowName)
            return;
          const reply: CommunicationMessage = {
            replyId: replyId,
            message: data,
            cbEvent: true,
            targetWindowName: comMessage.srcWindowName,
          };
          // post message data
          this.postMessage(replyWindowId, reply, e.origin);
        })
        .catch((error) => {
          if ((message.options && message.options.noReply) || comMessage.srcWindowName === comMessage.targetWindowName)
            return;
          const err = new CbError(error);
          const reply: CommunicationMessage = {
            replyId: replyId,
            error: jsonify(err),
            message: error.message,
            cbEvent: true,
            targetWindowName: comMessage.srcWindowName,
          };
          this.postMessage(replyWindowId, reply, e.origin);
        });
    });
  }

  postMessage(iframeId, message, targetDomain) {
    // TODO additional check
    // child components can only respond to parent
    Assert.notTrue(
      () => (this.windowType == WindowType.Component ? iframeId == Ids.MASTER_FRAME : true),
      t(Errors.responseError)
    );
    Assert.notTrue(
      () => (this.windowType == WindowType.Component ? targetDomain == Helpers.getJSDomainIframeCommunication() : true),
      t(Errors.responseMismatchError)
    );
    if (debugMode()) console.log(`response to --> ${iframeId} ${JSON.stringify(message)}`);
    const targetWindow = this.getTargetWindow(iframeId, {
      target_iframe_name: iframeId,
      message_action: message.targetWindowName,
    });

    try {
      logTargetWindow({
        targetWindow,
        message,
        targetIframeName: iframeId,
        windowType: this.windowType,
        handlerType: MessageHandler.Receiver,
      });
    } catch (e) {
      console.error(e);
    }

    iframePostMessage(targetWindow, message, targetDomain, MessageHandler.Receiver);
  }

  getTargetWindow(targetIframeName: string, metaInfo?: object): Window {
    try {
      if (this.windowType == WindowType.Host) {
        return window.frames[targetIframeName];
      }

      if (!targetIframeName || targetIframeName == Ids.HOST_NAME) {
        return window.parent;
      } else {
        return window.parent.frames[targetIframeName];
      }
    } catch (e) {
      // ignore cross origin error
      if (this.windowType === WindowType.Component || this.windowType === WindowType.Master) {
        const errorMeta = {
          ...metaInfo,
          ...window['cb_site_info'],
        };
        Logger.error(e, errorMeta);
        // Logger.kvl(jsonifyError(e), errorMeta);
      }
    }
  }
}
