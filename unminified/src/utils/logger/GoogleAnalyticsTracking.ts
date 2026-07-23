import Helpers from '@/helpers/index';

export default class GoogleAnalyticsTracking {
  static log(action: string, category: string, gaIntegType: GAIntegrationType) {
    const cbInstance = Helpers.getCbInstance();
    let hpToken;
    if (cbInstance) {
      hpToken = cbInstance.getHpToken();
    }
    if (action != undefined && category != undefined && gaIntegType != undefined) {
      if (action == 'generate_lead' || 'purchase' || 'lead' || 'chargebee_ecommerce') {
        Helpers.sendKVL({
          hp_token: hpToken,
          hp_ga_event_type: action,
          hp_ga_event_category: category,
          hp_ga_integration: gaIntegType,
        });
      }
    }
  }
}

export enum GAIntegrationType {
  GOOGLE_ANALYTICS = 'GOOGLE_ANALYTICS',
  GOOGLE_TAG_MANAGER = 'GOOGLE_TAG_MANAGER',
}
