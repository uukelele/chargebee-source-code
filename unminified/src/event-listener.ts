import {
  PAYMENT_SOURCE_REMOVE,
  PAYMENT_SOURCE_UPDATE,
  PAYMENT_SOURCE_ADD,
  SUBSCRIPTION_CHANGED,
  SUBSCRIPTION_CANCELLED,
  SUBSCRIPTION_REACTIVATED,
  SUBSCRIPTION_EXTENDED,
  SUBSCRIPTION_CF_CHANGED,
  SUBSCRIPTION_RESUMED,
  SCHEDULED_CANCELLATION_REMOVED,
  SCHEDULED_PAUSE_REMOVED,
  SUBSCRIPTION_PAUSED,
} from '@/constants/callbacks';
import {ManagerType} from '@/interfaces/cb-manager';
import CbWindowManager from '@/models/cb-window-manager';
import {PageType} from '@/constants/enums';
import {PAGE_VISITED, CLOSE, SUCCESS, ERROR, LOADED, CHECKOUT_STEP} from '@/constants/callbacks';
import Helpers from '@/helpers/index';
import Handler from '@/models/handler';
import EventKeys from '@/constants/event-keys';
import 'url-polyfill';
import EventInterface from '@/hosted_page/host/event/event-interface';
import ErrorHandler, {ErrorType} from '@/error-handler';
import {getGAPurchaseAckPromise, getPurchaseEventFiredAt} from '@/callbacks/ga-callbacks';

let eventMethod = window.addEventListener ? 'addEventListener' : 'attachEvent';
let eventer = window[eventMethod];
let messageEvent = eventMethod == 'attachEvent' ? 'onmessage' : 'message';

function reset() {
  if (!Helpers.flags.resetHandlerCalled) {
    Handler.reset();
    Helpers.setFlag('resetHandlerCalled', true);
  }
}

var cbEventHandler = function (e) {
  var cbInstance = Helpers.getCbInstance();

  if (cbInstance && e.origin == Helpers.getJSDomainIframeCommunication()) {
    // TODO Determine who should process the message
    if (cbInstance.componentLoader) cbInstance.componentLoader.listen(e);
    else if (cbInstance.threeDSLoader) cbInstance.threeDSLoader.listen(e);
    return;
  }

  const domainsToCheck = Helpers.getDomainsToCheck();
  if (domainsToCheck.indexOf(e.origin) == -1) {
    if (e.data == EventKeys.LOADED) {
      new ErrorHandler({key: ErrorType.hostMisMatch, data: e}).handle();
    }
    return;
  }

  if (!cbInstance) {
    return;
  }

  if (e.data == EventKeys.LOADER_OPENED) {
    Handler.manager.type == ManagerType.WINDOW_MANAGER && (<CbWindowManager>Handler.manager).markAsOpened();
  }

  // TODO use switch case
  // assert CbInstance
  if (e.data == EventKeys.CLOSE) {
    Handler.page.callbacks[CLOSE] && Handler.page.callbacks[CLOSE]();
    reset();
  }

  if (e.data == EventKeys.FRAME_UNLOADED) {
    if (Handler.manager.type === ManagerType.IFRAME_MANAGER && !Helpers.flags.resetHandlerCalled) {
      Handler.page.callbacks[CLOSE] && Handler.page.callbacks[CLOSE]();
      reset();
    }
  }

  if (e.data == EventKeys.SUCCESS) {
    // Deprecated
    Handler.page.callbacks[SUCCESS] && Handler.page.callbacks[SUCCESS]();
    // Handler.reset();
  }

  if (e.data == EventKeys.ERROR) {
    Handler.page.callbacks[ERROR] && Handler.page.callbacks[ERROR]();
    Handler.reset();
  }

  if (e.data == EventKeys.UNAUTHENTICATED) {
    cbInstance.authHandler.reset();
  }

  if (e.data == EventKeys.PAYMENT_SOURCE_REMOVE) {
    Handler.page.callbacks[PAYMENT_SOURCE_REMOVE] && Handler.page.callbacks[PAYMENT_SOURCE_REMOVE]();
  }

  // TODO check for chargebee domain
  if (e.data == EventKeys.LOADED && Handler.page) {
    Handler.showPage();
    Helpers.resetFlags();
    var cbFrame = window.document.getElementById('cb-frame');
    // cbFrame.style.visibility = "visible";
    Handler.page.callbacks[LOADED] && Handler.page.callbacks[LOADED]();

    if (Handler.manager instanceof CbWindowManager) {
      Handler.manager.closeCallWatch(Handler);
    }
  }

  if (typeof e.data == 'object') {
    if (e.data.key == EventKeys.PAGE_VISITED && Handler.page) {
      if (Handler.page.type == PageType.CHECKOUT) {
        Handler.page.callbacks[CHECKOUT_STEP] && Handler.page.callbacks[CHECKOUT_STEP](e.data.value);
      }
      if (Handler.page.type == PageType.PORTAL) {
        Handler.page.callbacks[PAGE_VISITED] && Handler.page.callbacks[PAGE_VISITED](e.data.value);
      }
    }

    if (e.data.key == EventKeys.SUCCESS) {
      Handler.page.callbacks[SUCCESS] && Handler.page.callbacks[SUCCESS](e.data.value, e.data.data);
      if (e.data.redirectUrl) {
        const REDIRECT_TIMEOUT_MS = 3000;
        const redirectUrl = e.data.redirectUrl;
        const customerId = e.data.customerId;

        /** Delay after sending KVL before redirect so the request can be sent before page unload */
        const KVL_SEND_DELAY_MS = 1000;

        const doRedirect = (resolvedBy: 'event_callback' | 'timeout') => {
          const firedAt = getPurchaseEventFiredAt();
          const waitMs = firedAt ? Date.now() - firedAt : null;
          try {
            Helpers.sendKVL({
              customerId,
              module: 'chargebee.js',
              redirectUrl: new URL(redirectUrl).host,
              ga_redirect_after_delay: true,
              ga_resolved_by: resolvedBy,
              ga_wait_ms: waitMs,
            });
          } catch (ex) {
            //
          }
          const doNavigate = () => {
            if (cbInstance.enableTopLevelRedirectOnSuccess) {
              try {
                window.top.location = redirectUrl;
              } catch (ex) {
                window.location.href = redirectUrl;
              }
            } else {
              if (Handler.manager.type === ManagerType.WINDOW_MANAGER) {
                Handler.reset();
              }
              window.location.href = redirectUrl;
            }
          };
          window.setTimeout(doNavigate, KVL_SEND_DELAY_MS);
        };

        const gaPurchaseAck = getGAPurchaseAckPromise();
        const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, REDIRECT_TIMEOUT_MS));

        if (gaPurchaseAck != null) {
          let settled = false;
          gaPurchaseAck.then(() => {
            if (settled) return;
            settled = true;
            doRedirect('event_callback');
          });
          timeoutPromise.then(() => {
            if (settled) return;
            settled = true;
            doRedirect('timeout');
          });
        } else {
          timeoutPromise.then(() => doRedirect('timeout'));
        }
      }
      // Handler.reset();
    }

    if (e.data.key == EventKeys.PAYMENT_SOURCE_ADD) {
      Handler.page.callbacks[PAYMENT_SOURCE_ADD] && Handler.page.callbacks[PAYMENT_SOURCE_ADD](e.data.status);
    }

    if (e.data.key == EventKeys.PAYMENT_SOURCE_UPDATE) {
      Handler.page.callbacks[PAYMENT_SOURCE_UPDATE] && Handler.page.callbacks[PAYMENT_SOURCE_UPDATE](e.data.status);
    }

    if (e.data.key == EventKeys.AUTHENTITCATED) {
      cbInstance.authHandler.close(e.data.value);
    }

    if (e.data.key == EventKeys.SET_HP_TOKEN && e.data.value) {
      cbInstance.setHpToken(e.data.value);
    }

    handleSubscriptionEvent(e);
  }
};

var handleSubscriptionEvent = function (e) {
  switch (e.data.key) {
    case EventKeys.SUBSCRIPTION_CHANGED: {
      Handler.page.callbacks[SUBSCRIPTION_CHANGED] && Handler.page.callbacks[SUBSCRIPTION_CHANGED](e.data.value);
      break;
    }
    case EventKeys.SUBSCRIPTION_CF_CHANGED: {
      Handler.page.callbacks[SUBSCRIPTION_CF_CHANGED] && Handler.page.callbacks[SUBSCRIPTION_CF_CHANGED](e.data.value);
      break;
    }
    case EventKeys.SUBSCRIPTION_CANCELLED: {
      Handler.page.callbacks[SUBSCRIPTION_CANCELLED] && Handler.page.callbacks[SUBSCRIPTION_CANCELLED](e.data.value);
      break;
    }
    case EventKeys.SCHEDULED_CANCELLATION_REMOVED: {
      Handler.page.callbacks[SCHEDULED_CANCELLATION_REMOVED] &&
        Handler.page.callbacks[SCHEDULED_CANCELLATION_REMOVED](e.data.value);
      break;
    }
    case EventKeys.SUBSCRIPTION_REACTIVATED: {
      Handler.page.callbacks[SUBSCRIPTION_REACTIVATED] &&
        Handler.page.callbacks[SUBSCRIPTION_REACTIVATED](e.data.value);
      break;
    }
    case EventKeys.SUBSCRIPTION_EXTENDED: {
      Handler.page.callbacks[SUBSCRIPTION_EXTENDED] && Handler.page.callbacks[SUBSCRIPTION_EXTENDED](e.data.value);
      break;
    }
    case EventKeys.SUBSCRIPTION_RESUMED: {
      Handler.page.callbacks[SUBSCRIPTION_RESUMED] && Handler.page.callbacks[SUBSCRIPTION_RESUMED](e.data.value);
      break;
    }
    case EventKeys.SCHEDULED_PAUSE_REMOVED: {
      Handler.page.callbacks[SCHEDULED_PAUSE_REMOVED] && Handler.page.callbacks[SCHEDULED_PAUSE_REMOVED](e.data.value);
      break;
    }
    case EventKeys.SUBSCRIPTION_PAUSED: {
      Handler.page.callbacks[SUBSCRIPTION_PAUSED] && Handler.page.callbacks[SUBSCRIPTION_PAUSED](e.data.value);
      break;
    }
    case EventKeys.SUBSCRIPTION_CANCEL_BRIGHTBACK_INITIATED: {
      if (e.data.url) {
        window.location.href = e.data.url;
      }
      break;
    }
  }
};

// Listen to message from child window
export default function () {
  eventer(
    messageEvent,
    (e) => {
      try {
        cbEventHandler(e);
      } catch (error) {
        console.error(error);
      }
      try {
        const domainsToCheck = Helpers.getDomainsToCheck();
        if (domainsToCheck.indexOf(e.origin) == -1) {
          if (e.data && e.data.key == EventKeys.LOADED) {
            new ErrorHandler({key: ErrorType.hostMisMatch, data: e}).handle();
          }
          return;
        }
        EventInterface.onEvent(e);
      } catch (error) {
        console.error(error);
      }
    },
    false
  );
}
