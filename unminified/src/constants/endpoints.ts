export default class EndPoints {
  static readonly AUTHENTICATION = '/portal/v2/authenticate';
  static readonly PORTAL_HOME = '/portal/v2/home';
  static readonly PORTAL_DEFAULT = '/portal/v2/';
  static readonly PORTAL_LOGOUT = '/portal/v2/logout';
  static readonly PLAN_SPECIFIC_HOSTED_PAGE = (params) => {
    let planId = params.planId;
    delete params.planId;
    return `/hosted_pages/plans/${planId}`;
  };

  static readonly ITEM_SPECIFIC_HOSTED_PAGE = '/hosted_pages/checkout';
  static readonly ONE_TIME_CHECKOUT_HOSTED_PAGE = '/hosted_pages/checkout/onetime';
}
