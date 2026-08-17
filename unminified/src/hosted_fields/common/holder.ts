import {ActionInnerMessage, ResponseInnerMessage} from '@/hosted_fields/common/types';
import BaseAction from '@/hosted_fields/common/base-action';
interface ActionRegistry {
  [actionName: string]: BaseAction;
}

class ActionsHolder {
  actionRegistry: ActionRegistry = {};
  registerAction(actionName: string, action: BaseAction) {
    this.actionRegistry[actionName] = action;
  }

  resolve(message: ActionInnerMessage): Promise<ResponseInnerMessage> | undefined {
    const action: BaseAction = this.actionRegistry[message.action];
    if (!action || !action.handle) {
      // Intentionally return undefined so Receiver can ignore unknown actions.
      // Payment Component hosts Chargebee.js (Host Receiver) in the same iframe
      // that also handles fetchCardData via a React message listener — Host must
      // not crash or reply for that action.
      console.log(`Unknown action: ${message.action}`);
      return undefined;
    }
    return action.handle(message);
  }
}

const actionHolder = new ActionsHolder();

export default actionHolder;
