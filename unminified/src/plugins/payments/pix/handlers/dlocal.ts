import PixHandler from '@/plugins/payments/pix/handlers/index';

/**
 * DLocal gateway-specific PIX handler
 * DLocal is the primary gateway for PIX payments
 */
export default class DLocalPixHandler extends PixHandler {
  constructor(handler: PixHandler, ...args) {
    super(...args);
    // Copy properties from parent handler
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }
}
