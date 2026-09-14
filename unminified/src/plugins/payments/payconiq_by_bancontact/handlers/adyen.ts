import PayconiqByBancontactHandler from '@/plugins/payments/payconiq_by_bancontact/handlers';
import {PaymentInfo} from '@/plugins/payments/payconiq_by_bancontact/types';
import Callbacks from '@/callbacks';

export default class AdyenPayconiqByBancontactHandler extends PayconiqByBancontactHandler {
  constructor(handler: PayconiqByBancontactHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
  }

  handlePayment(paymentInfo: PaymentInfo, callbacks?: Callbacks): Promise<any> {
    this.setRenderInfo(paymentInfo && paymentInfo.renderInfo);
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
