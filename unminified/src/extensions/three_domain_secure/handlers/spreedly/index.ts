import AbstractThreeDSecureHandler from '@/extensions/three_domain_secure/handlers/abstract';
import {PaymentAttempt, PaymentAttemptStatus, CardInfo} from '@/extensions/three_domain_secure/common/types';
import {loadScript, validateRawCardDetails} from '@/extensions/three_domain_secure/common/utils';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import LightBox from '@/extensions/three_domain_secure/common/lightbox';
import {Address} from '@/plugins/three_domain_secure/types';

let eventMethod = window.addEventListener ? 'addEventListener' : 'attachEvent';
let eventer = window[eventMethod];
let messageEvent = eventMethod == 'attachEvent' ? 'onmessage' : 'message';

export class Spreedly3DSHandler extends AbstractThreeDSecureHandler {
  private lightBox: LightBox;
  private event;
  private hiddenIframeDivID: string = 'cb-hidden-iframe-div-id';
  private lifecycle;

  private jsUrl: string = 'https://core.spreedly.com/iframe/iframe-v1.min.js';
  private jsNamespace: string = 'Spreedly';
  private spreedlyResolver = (resolve) => {
    return (event) => resolve(event);
  };

  validate(): boolean {
    const hasReferenceId = !!this.getReferenceId();
    const hasRawCardDetails = !!this.paymentInfo.card;
    const hasCbToken = !!this.paymentInfo.cbToken;
    const hasCardComponent = !!this.paymentInfo.cardComponent;
    const hasPaymentComponent = !!this.paymentInfo.paymentComponent;

    if (!hasReferenceId && !hasRawCardDetails && !hasCbToken && !hasCardComponent && !hasPaymentComponent) {
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
        const hasPaymentComponent = !!this.paymentInfo.paymentComponent;
        if (!!this.paymentInfo.card) {
          payload.paymentMethod = this.paymentInfo.card;
        }
        if (!!this.paymentInfo.cbToken) {
          payload.cbToken = this.paymentInfo.cbToken;
        }
        if (hasCardComponent) {
          payload.cardComponent = this.paymentInfo.cardComponent;
        }
        if (hasPaymentComponent) {
          payload.paymentComponent = this.paymentInfo.paymentComponent;
        }
        const billingAddress: Address = this.getCardBillingAddress();
        if (billingAddress) {
          payload.cardBillingAddress = billingAddress;
          payload.billingAddress = billingAddress;
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
        case PaymentAttemptStatus.REQUIRES_IDENTIFICATION:
          this.callChange();
          return this.identify(paymentAttempt.action_payload.transaction);
        case PaymentAttemptStatus.REQUIRES_CHALLENGE:
          this.callChange();
          return this.challenge(paymentAttempt.action_payload.transaction);
        case PaymentAttemptStatus.REQUIRES_REDIRECTION:
          this.callChange();
          return this.fallbackTo3DS1(paymentAttempt.action_payload.transaction);
        case PaymentAttemptStatus.REFUSED:
          throw this.intentError();
        default:
          throw new CbError(Errors.unknownPaymentAttemptStatus);
      }
    });
  }

  getLifecycle(transaction: any): any {
    var Spreedly = this.spreedly();
    return new Spreedly.ThreeDS.Lifecycle({
      hiddenIframeLocation: this.lightBox.getHiddenElId(),
      challengeIframeLocation: this.lightBox.getWrapperElId(),
      transactionToken: transaction.token,
    });
  }

  identify(transaction: any): Promise<any> {
    var Spreedly = this.spreedly();
    let spreedlyResolver;
    return new Promise((resolve, reject) => {
      this.lifecycle = this.getLifecycle(transaction);
      this.lifecycle.start(transaction);
      spreedlyResolver = this.spreedlyResolver(resolve);
      Spreedly.on('3ds:status', spreedlyResolver);
    }).then((event: any) => {
      if (event.action === 'succeeded') {
        return this.confirmPayment();
      } else if (event.action === 'error') {
        let error = (event.context.errors && event.context.errors[0]) || event.context;
        throw new CbError(error);
      } else if (event.action === 'trigger-completion' || event.action === 'device-fingerprint') {
        // HACK : device-fingerprint action is not mentioned in spreedly docs but we get this action for 3003, 3004 .
        this.event = event;
        Spreedly.emitter.off('3ds:status', spreedlyResolver);
        return this.confirmPayment();
      }
    });
  }

  challenge(transaction: any): Promise<any> {
    var Spreedly = this.spreedly();
    let spreedlyResolver;
    return new Promise((resolve, reject) => {
      if (!this.lifecycle) {
        this.lifecycle = this.getLifecycle(transaction);
        this.lifecycle.start(transaction);
      }
      spreedlyResolver = this.spreedlyResolver(resolve);
      Spreedly.on('3ds:status', spreedlyResolver);
      if (this.event && transaction.state === 'pending') {
        this.event.finalize(transaction);
      }
    })
      .then((event: any) => {
        if (event.action === 'succeeded') {
          return this.confirmPayment();
        } else if (event.action === 'error') {
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
        } else if (event.action === 'error') {
          let error = (event.context.errors && event.context.errors[0]) || event.context;
          throw new CbError(error);
        }
      });
  }

  // challenge(transaction: any): Promise<any> {
  //   let spreedlyResolver;
  //   var Spreedly = this.spreedly();
  //   return Promise.resolve(true).then(() => {
  //     if(this.lifecycle) {
  //       return new Promise((resolve, reject) => {
  //         if (this.event && transaction.state === 'pending') {
  //           spreedlyResolver = this.spreedlyResolver(resolve);
  //           Spreedly.on('3ds:status', spreedlyResolver);
  //           this.event.finalize(transaction);
  //         }
  //       }).then((event:any) => {
  //         if (event.action === 'error') {
  //           let error = (event.context.errors && event.context.errors[0]) || event.context
  //           throw new CbError(error);
  //         } else if (event.action === 'challenge') {
  //           this.lightBox.open();
  //           Spreedly.emitter.off('3ds:status', spreedlyResolver);
  //           return new Promise((resolve, reject) => {
  //             spreedlyResolver = this.spreedlyResolver(resolve);
  //             Spreedly.on('3ds:status', spreedlyResolver);
  //           })
  //         }
  //       })
  //     } else {
  //       return new Promise((resolve, reject) => {
  //         this.lifecycle = this.getLifecycle(transaction);
  //         this.lifecycle.start(transaction);
  //         spreedlyResolver = this.spreedlyResolver(resolve);
  //         Spreedly.on('3ds:status', spreedlyResolver);
  //         this.lightBox.open();
  //       });
  //     }
  //   }).then((event: any) => {
  //     if (event.action === 'succeeded') {
  //       return this.confirmPayment();
  //     } else if (event.action === 'error') {
  //       let error = (event.context.errors && event.context.errors[0]) || event.context
  //       throw new CbError(error);
  //     }
  //   });
  // }

  fallbackTo3DS1(transaction: any): Promise<any> {
    if (transaction.checkout_form) {
      return this.handleForm(transaction);
    } else {
      return this.handleUrl(transaction);
    }
  }

  handleForm(transaction: any): Promise<any> {
    this.lightBox.setFormXHTML(transaction.checkout_form);
    this.lightBox.open();
    return new Promise((resolve, reject) => {
      // TODO remove callback
      eventer(messageEvent, (event) => {
        if (event.data.token == transaction.token) {
          resolve(true);
        }
      });
    }).then(() => {
      return this.confirmPayment();
    });
  }

  handleUrl(transaction: any): Promise<any> {
    return new Promise((resolve, reject) => {
      reject('Unhandled 3DS flow');
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
