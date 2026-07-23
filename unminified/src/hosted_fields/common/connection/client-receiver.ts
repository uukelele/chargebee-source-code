import {CommunicationMessage} from '@/hosted_fields/common/types';
import ReplyMessage from '@/hosted_fields/common/connection/reply-message';
import Errors, {CbError} from '@/hosted_fields/common/errors';

interface ReplyMessages {
  [id: string]: ReplyMessage;
}

export default class ClientReceiver {
  replyMessages: ReplyMessages = {};

  add(message: ReplyMessage) {
    this.replyMessages[message.messageId] = message;
  }

  listen(event: MessageEvent) {
    const commMessage: CommunicationMessage = event.data;
    if (!commMessage || !commMessage.cbEvent) {
      return;
    }
    const reply = this.replyMessages[commMessage.replyId];
    if (!reply) {
      return;
    }

    if (event.origin != reply.targetDomain) {
      const err = new CbError(Errors.unknownMessageOrigin, {
        origin: event.origin,
        target: reply.targetDomain,
      });
      reply.rejector(err);
    }

    if (commMessage.error) {
      const error = new CbError(commMessage.error);
      reply.rejector(error);
    }

    reply.resolver(commMessage.message);
    reply.markAsRecieved();
    delete this.replyMessages[commMessage.replyId];
  }
}
