import Helpers from '@/helpers';
import EventKeys from '@/constants/event-keys';
import {CHECKOUT_CALLBACK_KEYS, CHECKOUT_STEP, CLOSE, ERROR, LOADED, RESIZE, SUCCESS} from '@/constants/callbacks';
import {PageType} from '@/constants/enums';
import {CbCallbacksInterface, CbTotalCallbacks} from '@/interfaces/cb-types';

export type EventCallbacks = {
  [key in (typeof CHECKOUT_CALLBACK_KEYS)[number]]: Function;
};

export type Event = {
  data: any;
};

export interface Listener {
  type: PageType;
  callbacks: EventCallbacks;
}

export function combineDefaultCallbacks(defaultCallbacks: CbTotalCallbacks): CbCallbacksInterface {
  const result: EventCallbacks = {};
  if (defaultCallbacks) {
    for (let key of Object.keys(defaultCallbacks)) {
      result[key] = function () {
        defaultCallbacks[key].forEach((fn: Function) => {
          fn.apply(undefined, arguments);
        });
      };
    }
  }
  return result;
}

export default class EventInterface {
  static listeners: Map<string, Listener> = new Map();

  public static registerListener(callbacks: EventCallbacks, type: PageType): string {
    const listenerId = Helpers.genUuid();
    this.listeners.set(listenerId, {callbacks, type});
    return listenerId;
  }

  public static unregisterListener(id: string) {
    this.listeners.delete(id);
  }

  public static onEvent(e: Event) {
    for (let listener of this.listeners.values()) {
      if (e.data == EventKeys.CLOSE) {
        listener.callbacks[CLOSE] && listener.callbacks[CLOSE]();
      }

      if (e.data == EventKeys.ERROR) {
        listener.callbacks[ERROR] && listener.callbacks[ERROR]();
      }

      if (e.data == EventKeys.LOADED) {
        listener.callbacks[LOADED] && listener.callbacks[LOADED]();
      }

      if (typeof e.data == 'object') {
        if (e.data.key == EventKeys.PAGE_VISITED) {
          if (listener.type == PageType.CHECKOUT) {
            listener.callbacks[CHECKOUT_STEP] && listener.callbacks[CHECKOUT_STEP](e.data.value);
          }
        }

        if (e.data.key == EventKeys.RESIZE) {
          listener.callbacks[RESIZE] && listener.callbacks[RESIZE](e.data.height);
        }

        if (e.data.key == EventKeys.SUCCESS) {
          listener.callbacks[SUCCESS] && listener.callbacks[SUCCESS](e.data.value, e.data.data, e.data.redirectUrl);
        }
      }
    }
  }
}
