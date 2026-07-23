export default class EventKeys {
  static readonly CLOSE: string = 'cb.close';
  static readonly SUCCESS: string = 'cb.success';
  static readonly ERROR: string = 'cb.error';
  static readonly UNAUTHENTICATED: string = 'cb.unauthenticated';
  static readonly AUTHENTITCATED: string = 'cb.authenticated';
  static readonly LOADED: string = 'cb.loaded';
  static readonly FRAME_UNLOADED: string = 'cb.frameunload';
  static readonly STYLE_CONFIG: string = 'cb.style_config';
  static readonly PAGE_VISITED: string = 'cb.page_visited';
  static readonly PAYMENT_SOURCE_ADD: string = 'cb.payment_source.add';
  static readonly PAYMENT_SOURCE_UPDATE: string = 'cb.payment_source.update';
  static readonly PAYMENT_SOURCE_REMOVE: string = 'cb.payment_source.remove';
  static readonly SUBSCRIPTION_CANCELLED: string = 'cb.subscription.cancelled';
  static readonly SUBSCRIPTION_CHANGED: string = 'cb.subscription.changed';
  static readonly SUBSCRIPTION_CF_CHANGED: string = 'cb.subscription.cf_changed';
  static readonly SUBSCRIPTION_REACTIVATED: string = 'cb.subscription.reactivated';
  static readonly SUBSCRIPTION_EXTENDED: string = 'cb.subscription.extended';
  static readonly SUBSCRIPTION_RESUMED: string = 'cb.subscription.resumed';
  static readonly SCHEDULED_PAUSE_REMOVED: string = 'cb.subscription.scheduled_pause_removed';
  static readonly SUBSCRIPTION_PAUSED: string = 'cb.subscription.paused';
  static readonly LOADER_OPENED: string = 'cb.loader_opened';
  static readonly SCHEDULED_CANCELLATION_REMOVED: string = 'cb.subscription.scheduled_cancellation_removed';
  static readonly SUBSCRIPTION_CANCEL_BRIGHTBACK_INITIATED: string = 'cb.subscription.cancel_brightback.initiated';
  static readonly SET_HP_TOKEN: string = 'cb.set_hp_token';
  static readonly RESIZE: string = 'cb.resize';
}
