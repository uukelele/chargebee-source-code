import Helpers from '@/helpers/index';
import {ResponseInnerMessage, ActionInnerMessage, ReplyMessageOptions} from '@/hosted_fields/common/types';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {debugMode} from '@/constants/environment';

export default class ReplyMessage {
  messageId: string;
  targetDomain: string;
  selfDestructor: number;
  messageListener: number;
  options: ReplyMessageOptions;

  resolver: (value?: ActionInnerMessage | ResponseInnerMessage) => void;
  rejector: (reason?: any) => void;

  constructor(targetDomain, options: ReplyMessageOptions = {}) {
    this.messageId = Helpers.genUuid();
    this.targetDomain = targetDomain;
    this.options = options;
    const startTime = new Date().getTime();
    const selfDestructTimeout = options.timeout || 5000;
    this.selfDestructor = window.setTimeout(() => {
      if (debugMode()) {
        console.error(options.action, 'timed out');
      }
      const endTime = new Date().getTime();
      Helpers.sendKVL({
        action: 'message_action_timeout',
        message_action: options.action,
        message_timeout: options.timeout,
        action_time_taken: endTime - startTime,
      });
      this.rejector(new CbError(Errors.replyTimeout, {action: (options && options.action) || 'unknown'}));
    }, selfDestructTimeout);
  }

  markAsRecieved() {
    window.clearTimeout(this.selfDestructor);
  }
}
