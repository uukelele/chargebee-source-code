export const AFTER_URL_FETCH = 'afterUrlFetch';
export const LOADED = 'loaded';
export const SUCCESS = 'success';
export const ERROR = 'error';
export const AFTER_AUTH_SET = 'afterAuthSet';
export const CLOSE = 'close';
export const PAGE_VISITED = 'visit';
export const CHECKOUT_STEP = 'step';
export const PAYMENT_SOURCE_ADD = 'paymentSourceAdd';
export const PAYMENT_SOURCE_UPDATE = 'paymentSourceUpdate';
export const PAYMENT_SOURCE_REMOVE = 'paymentSourceRemove';
export const SUBSCRIPTION_CANCELLED = 'subscriptionCancelled';
export const SUBSCRIPTION_CHANGED = 'subscriptionChanged';
export const SUBSCRIPTION_CF_CHANGED = 'subscriptionCustomFieldsChanged';
export const SUBSCRIPTION_REACTIVATED = 'subscriptionReactivated';
export const SUBSCRIPTION_EXTENDED = 'subscriptionExtended';
export const SUBSCRIPTION_RESUMED = 'subscriptionResumed';
export const SCHEDULED_PAUSE_REMOVED = 'scheduledPauseRemoved';
export const SCHEDULED_CANCELLATION_REMOVED = 'scheduledCancellationRemoved';
export const SUBSCRIPTION_PAUSED = 'subscriptionPaused';
export const RESIZE = 'resize';
export const CHECKOUT_CALLBACK_KEYS = [
  AFTER_URL_FETCH,
  LOADED,
  SUCCESS,
  ERROR,
  AFTER_AUTH_SET,
  CLOSE,
  CHECKOUT_STEP,
  PAYMENT_SOURCE_ADD,
  PAYMENT_SOURCE_UPDATE,
  PAYMENT_SOURCE_REMOVE,
  SUBSCRIPTION_EXTENDED,
  RESIZE,
];

export const PORTAL_CALLBACK_KEYS = [
  LOADED,
  CLOSE,
  ERROR,
  PAGE_VISITED,
  PAYMENT_SOURCE_REMOVE,
  PAYMENT_SOURCE_ADD,
  PAYMENT_SOURCE_UPDATE,
  SUBSCRIPTION_CANCELLED,
  SUBSCRIPTION_CHANGED,
  SUBSCRIPTION_CF_CHANGED,
  SUBSCRIPTION_REACTIVATED,
  SUBSCRIPTION_EXTENDED,
  SUBSCRIPTION_RESUMED,
  SUBSCRIPTION_PAUSED,
  SCHEDULED_PAUSE_REMOVED,
  SCHEDULED_CANCELLATION_REMOVED,
];
