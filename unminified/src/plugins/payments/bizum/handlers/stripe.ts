import BizumHandler from './index';

/**
 * Stripe gateway handler for Bizum. Thin wrapper — all logic in BizumHandler (base).
 */
export default class StripeBizumHandler extends BizumHandler {
  constructor(handler: BizumHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  initPayment() {
    return super.initPayment();
  }
}
