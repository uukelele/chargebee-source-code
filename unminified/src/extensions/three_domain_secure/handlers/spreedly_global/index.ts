import AbstractThreeDSecureHandler from '@/extensions/three_domain_secure/handlers/abstract';
import {PaymentAttempt, PaymentAttemptStatus, CardInfo} from '@/extensions/three_domain_secure/common/types';
import {loadScript, validateRawCardDetails} from '@/extensions/three_domain_secure/common/utils';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import LightBox from '@/extensions/three_domain_secure/common/lightbox';
import ThreeDSecureHandler from '@/extensions/three_domain_secure/index';
import {Address} from '@/plugins/three_domain_secure/types';

let eventMethod = window.addEventListener ? 'addEventListener' : 'attachEvent';
let eventer = window[eventMethod];
let messageEvent = eventMethod == 'attachEvent' ? 'onmessage' : 'message';

export class SpreedlyGlobal3DSHandler extends AbstractThreeDSecureHandler {
  private spreedlyConfig: any;
  private lightBox: LightBox;
  private lifecycle;

  private jsUrl: string = 'https://core.spreedly.com/iframe/iframe-v1.min.js';
  private jsNamespace: string = 'Spreedly';

  private spreedlyResolver = (resolve) => {
    return (event) => resolve(event);
  };

  constructor(parent: ThreeDSecureHandler, spreedlyConfig: any) {
    super(parent);
    this.spreedlyConfig = spreedlyConfig;
  }

  validate(): boolean {
    const hasReferenceId = !!this.getReferenceId();
    const hasRawCardDetails = !!this.paymentInfo.card;
    const hasCbToken = !!this.paymentInfo.cbToken;
    const hasCardComponent = !!this.paymentInfo.cardComponent;

    if (!hasReferenceId && !hasRawCardDetails && !hasCbToken && !hasCardComponent) {
      throw new CbError(Errors.missingSpreedlyPaymentInfo);
    }

    if (hasRawCardDetails) {
      validateRawCardDetails(this.paymentInfo.card);
    }

    return true;
  }

  handlePayment(): void {
    loadScript(this.jsUrl, this.jsNamespace)
      .then(() => {
        var payload: any = {
          browserInfoEncoded: this.spreedly().ThreeDS.serialize('05', '*/*'),
        };
        const hasCardComponent = !!this.paymentInfo.cardComponent;
        if (!!this.paymentInfo.card) {
          payload.paymentMethod = this.paymentInfo.card;
          const billingAddress: Address = this.getCardBillingAddress();
          if (billingAddress) {
            payload.cardBillingAddress = billingAddress;
            payload.billingAddress = billingAddress;
          }
        }
        if (!!this.paymentInfo.cbToken) {
          payload.cbToken = this.paymentInfo.cbToken;
        }
        if (hasCardComponent) {
          payload.cardComponent = this.paymentInfo.cardComponent;
        }
        this.lightBox = new LightBox('spreedly');
        return this.confirmPayment(payload);
      })
      .then(() => {
        this.closeLightBox();
        this.callSuccess();
      })
      .catch((err) => {
        this.closeLightBox();
        this.callError(err instanceof CbError ? err : new CbError(err));
      });
  }

  protected handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    return Promise.resolve(true).then(() => {
      switch (paymentAttempt.status) {
        case PaymentAttemptStatus.AUTHORIZED:
          return true;
        case PaymentAttemptStatus.REQUIRES_CHALLENGE:
          this.callChange();
          return this.challenge(paymentAttempt.action_payload.sca_authentication);
        case PaymentAttemptStatus.REFUSED:
          throw this.intentError();
        default:
          throw new CbError(Errors.unknownPaymentAttemptStatus);
      }
    });
  }

  getLifecycle(sca_authentication: any): any {
    var Spreedly = this.spreedly();
    return new Spreedly.ThreeDS.Lifecycle({
      environmentKey: this.spreedlyConfig.environment_key,
      hiddenIframeLocation: this.lightBox.getHiddenElId(),
      challengeIframeLocation: this.lightBox.getWrapperElId(),
      transactionToken: sca_authentication.token,
    });
  }

  challenge(sca_authentication: any): Promise<any> {
    var Spreedly = this.spreedly();
    let spreedlyResolver;
    return new Promise((resolve, reject) => {
      if (!this.lifecycle) {
        this.lifecycle = this.getLifecycle(sca_authentication);
        this.lifecycle.start(sca_authentication);
      }
      spreedlyResolver = this.spreedlyResolver(resolve);
      Spreedly.on('3ds:status', spreedlyResolver);
    })
      .then((event: any) => {
        if (event.action === 'succeeded') {
          return this.confirmPayment();
        } else if (event.action === 'error' || event.action === 'finalization-timeout') {
          let error = (event.context.errors && event.context.errors[0]) || event.context;
          throw new CbError(error);
        } else if (event.action === 'challenge') {
          this.lightBox.open();
          Spreedly.emitter.off('3ds:status', spreedlyResolver);
          return new Promise((resolve, reject) => {
            spreedlyResolver = this.spreedlyResolver(resolve);
            Spreedly.on('3ds:status', spreedlyResolver);
          });
        }
      })
      .then((event: any) => {
        if (event.action === 'succeeded') {
          return this.confirmPayment();
        } else if (event.action === 'error' || event.action === 'finalization-timeout') {
          let error = (event.context.errors && event.context.errors[0]) || event.context;
          throw new CbError(error);
        }
      });
  }

  spreedly(): any {
    return window[this.jsNamespace];
  }

  private closeLightBox() {
    if (this.lightBox) {
      this.lightBox.close();
      this.lightBox.destroy();
    }
  }
}
