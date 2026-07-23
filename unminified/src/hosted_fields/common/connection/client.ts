import Helpers from '@/helpers/index';
import Assert from '@/helpers/asserts';
import ClientReceiver from '@/hosted_fields/common/connection/client-receiver';
import ReplyMessage from '@/hosted_fields/common/connection/reply-message';
import {MessageHandler, WindowType, Master} from '@/hosted_fields/common/enums';
import {
  ActionInnerMessage,
  CommunicationMessage,
  ResponseInnerMessage,
  ReplyMessageOptions,
} from '@/hosted_fields/common/types';
import Errors from '@/hosted_fields/common/errors';
import t from '@/hosted_fields/common/locale';
import Ids from '@/constants/ids';
import Logger from '@/utils/logger_old';
import {logTargetWindow, iframePostMessage, jsonify} from '@/utils/utility-functions';
import {debugMode} from '@/constants/environment';

export const MASTER_IFRAME_NAME = Ids.MASTER_FRAME;
export const HOST_NAME = Ids.HOST_NAME;

let eventMethod = window.addEventListener ? 'addEventListener' : 'attachEvent';
let eventer = window[eventMethod];
let messageEvent = eventMethod == 'attachEvent' ? 'onmessage' : 'message';

class Client {
  receiver: ClientReceiver;
  windowType: WindowType;

  constructor(windowType = WindowType.Host, autoListen = false) {
    this.receiver = new ClientReceiver();
    this.windowType = windowType;
    // set properties like iframeId
    // whitelisted windows that we can send messages
    // for eg. client can send message only to master
    // master can send message to both child and host
    if (autoListen) {
      eventer(messageEvent, (e: MessageEvent) => {
        if (debugMode()) console.log('message received', e.data);
        this.receiver.listen(e);
      });
    }
  }

  messagePreFilter(message: ActionInnerMessage, targetIframeName: string, replyOptions: ReplyMessageOptions) {
    if (!message) return;
    switch (message.action) {
      case Master.Actions.RegisterComponent:
      case Master.Actions.CaptureException:
      case Master.Actions.CaptureKVL:
      // case Master.Actions.RegisterField:
      case Master.Actions.Destroy: {
        if (message.options) message.options.noReply = true;
        else message.options = {noReply: true};
        break;
      }
    }
  }

  sendMessage(
    _message: ActionInnerMessage,
    targetIframeName,
    replyOptions: ReplyMessageOptions = {}
  ): Promise<ResponseInnerMessage> {
    // Converting to Plain JSON to get rid of complex types
    const message: ActionInnerMessage = jsonify(_message);

    // child components can send message only to parent
    Assert.notTrue(
      () => (this.windowType == WindowType.Component ? targetIframeName == MASTER_IFRAME_NAME : true),
      t(Errors.sendMessageError)
    );
    return new Promise((resolve, reject) => {
      const targetDomain = this.getTargetDomain(targetIframeName);
      Assert.notTrue(
        () =>
          this.windowType == WindowType.Component ? targetDomain == Helpers.getJSDomainIframeCommunication() : true,
        t(Errors.sendMessageMismatchError)
      );

      // For logging the action that timesout
      if (replyOptions) replyOptions.action = message.action;
      else replyOptions = {action: message.action};
      let replyMessage: ReplyMessage;

      this.messagePreFilter(message, targetIframeName, replyOptions);
      const noReply = !!(message && message.options && message.options.noReply);
      if (!noReply) {
        replyMessage = new ReplyMessage(targetDomain, replyOptions);
        replyMessage.resolver = resolve;
        replyMessage.rejector = reject;
      }
      let targetWindow = this.getTargetWindow(targetIframeName, {
        message_action: message.action,
        target_iframe_name: targetIframeName,
      });
      if (noReply && !targetWindow) return resolve({acknowledged: true});
      Assert.notTrue(() => !!targetWindow, t(Errors.noMessageTarget));
      const payload = Client.constructPayload(
        message,
        replyMessage && replyMessage.messageId,
        this.getSrcWindowName(),
        targetIframeName
      );

      if (debugMode()) {
        console.log(`${this.getSrcWindowName()} → ${targetIframeName} : ${JSON.stringify(payload)}`);
        console.log(`${this.getSrcWindowName()} → ${targetIframeName} : ${JSON.stringify(payload)}`);
      }

      try {
        logTargetWindow({
          targetWindow,
          message,
          targetIframeName,
          windowType: this.windowType,
          handlerType: MessageHandler.Client,
        });
      } catch (e) {
        console.error(e);
      }

      iframePostMessage(targetWindow, payload, targetDomain, MessageHandler.Client);
      if (replyMessage) this.receiver.add(replyMessage);
      if (noReply) resolve({acknowledged: true});
    }).catch((err) => {
      // SentryLogger.logError(err)
      if (message && message.action === Master.Actions.GetBinData) {
        // we don't want to log card number or any other payload
        return Promise.reject(Logger.error(err));
      }
      return Promise.reject(Logger.error(err, {data: message}));
    });
  }

  static constructPayload(message, replyId, srcWindowName, targetWindowName): CommunicationMessage {
    // Add cbjs_source to KVL messages
    if (message && message.action === Master.Actions.CaptureKVL && message.data) {
      const cbjsSource = window.CbJsSource;
      if (cbjsSource) {
        message.data.cbjs_source = cbjsSource;
      }
    }

    return {
      message,
      replyId: replyId,
      srcWindowName,
      cbEvent: true,
      targetWindowName,
    };
  }

  private getTargetWindow(targetIframeName: string, metaInfo?: any): Window {
    try {
      if (this.windowType == WindowType.Host) {
        return window.frames[targetIframeName];
      }

      if (!targetIframeName || targetIframeName == HOST_NAME) {
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

  private getTargetDomain(targetIframeName: string): string {
    if (targetIframeName == HOST_NAME) {
      return window['hostName'];
    } else {
      return Helpers.getJSDomainIframeCommunication();
    }
  }

  private getSrcWindowName(): string {
    if (this.windowType == WindowType.Host) {
      return HOST_NAME;
    } else {
      return window.name;
    }
  }
}

export default Client;
