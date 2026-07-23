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

  resolve(message: ActionInnerMessage): Promise<ResponseInnerMessage> {
    const action: BaseAction = this.actionRegistry[message.action];
    if (!action || !action.handle) {
      console.log(`Unknown action: ${action}`);
    } else {
      return action.handle(message);
    }
  }
}

const actionHolder = new ActionsHolder();

export default actionHolder;
