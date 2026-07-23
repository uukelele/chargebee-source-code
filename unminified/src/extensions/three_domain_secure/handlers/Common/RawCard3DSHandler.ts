import ThreeDSecureHandler from '@/extensions/three_domain_secure/index';
import {ConfirmApiInputPayload} from '@/extensions/three_domain_secure/common/types';
import {CbError} from '@/hosted_fields/common/errors';
import Base3DSHandler from './index';
import {Base3DSConfig} from './types';

export default class RawCard3DSHandler extends Base3DSHandler {
  constructor(parent: ThreeDSecureHandler, config: Base3DSConfig) {
    super(parent, config);
  }

  async handlePayment(): Promise<void> {
    Promise.resolve(true)
      .then(() => {
        const confirmApiPayload: ConfirmApiInputPayload = this.getConfirmApiPayload();

        return this.confirmPayment(confirmApiPayload);
      })
      .catch((err) => {
        this.closeChallengeWindow();
        this.callError(err instanceof CbError ? err : new CbError(err));
      });
  }

  private getConfirmApiPayload(): ConfirmApiInputPayload {
    const {card, cbToken, cardComponent, paymentComponent} = this.paymentInfo;

    if (card) {
      return this.getConfirmPayload({card});
    }
    if (this.getReferenceId()) {
      return this.getConfirmPayload({});
    }
    if (cbToken) {
      return this.getConfirmPayload({cbToken});
    }
    if (cardComponent) {
      return this.getConfirmPayload({cardComponent});
    }
    if (paymentComponent) {
      return this.getConfirmPayload({paymentComponent});
    }
  }
}
