import {PageType} from '@/constants/enums';
import GACallbacks from '@/callbacks/ga-callbacks';
import FBQCallbacks from '@/callbacks/fbq-callbacks';
import RefersionCallbacks from '@/callbacks/refersion-callbacks';
import RefersionV4Callbacks from '@/callbacks/refersionv4-callbacks';
import FriendbuyCallbacks from '@/callbacks/friendbuy-callbacks';
import GTMCallbacks from '@/callbacks/gtm-callbacks';
import {CbTotalCallbacks} from '@/interfaces/cb-types';

/**@internal */
export default class Callbacks {
  public static getDefaultCallbackDefns(pageType: PageType): CbTotalCallbacks {
    let callbacks = {};
    this.mergeCallbackDefns(callbacks, GACallbacks.get(pageType));
    this.mergeCallbackDefns(callbacks, FBQCallbacks.get(pageType));
    this.mergeCallbackDefns(callbacks, RefersionCallbacks.get(pageType));
    this.mergeCallbackDefns(callbacks, RefersionV4Callbacks.get(pageType));
    this.mergeCallbackDefns(callbacks, FriendbuyCallbacks.get(pageType));
    this.mergeCallbackDefns(callbacks, GTMCallbacks.get(pageType));
    return callbacks;
  }

  public static mergeCallbackDefns(source, destination) {
    Object.keys(destination).forEach((callbackKey) => {
      if (!source[callbackKey]) {
        source[callbackKey] = [];
      }
      source[callbackKey].push(destination[callbackKey]);
    });
    return source;
  }
}
