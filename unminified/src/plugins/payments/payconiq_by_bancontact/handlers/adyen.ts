import PayconiqByBancontactHandler from '@/plugins/payments/payconiq_by_bancontact/handlers';
import {RenderOptions} from '../types';
import Callbacks from '@/callbacks';

export default class AdyenPayconiqByBancontactHandler extends PayconiqByBancontactHandler {
  constructor(handler: PayconiqByBancontactHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
  }

  handlePayment(options: RenderOptions, callbacks?: Callbacks): Promise<any> {
    this.setRenderOptions(options);
    return this.initiateAuthorization({}, callbacks);
  }

  getPaymentData(): any {
    const paymentAttempt = this.getPaymentAttempt();
    const additionalData =
      paymentAttempt && paymentAttempt.action_payload && paymentAttempt.action_payload.additionalData;

    const payload: any = {
      qrCode: (additionalData && additionalData['bcmcmobile.qrCode']) || null,
      urlIntent: (additionalData && additionalData['bcmcmobile.urlIntent']) || null,
    };
    return payload;
  }
}
