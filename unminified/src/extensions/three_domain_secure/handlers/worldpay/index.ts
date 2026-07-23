import Ids from '@/constants/ids';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import {Master as M} from '@/hosted_fields/common/enums';
import AbstractThreeDSecureHandler from '../abstract';
import {PaymentAttempt, PaymentAttemptStatus} from '@/plugins/three_domain_secure/types';
import {validateRawCardDetails} from '@/extensions/three_domain_secure/common/utils';
import Helpers from '@/helpers';
import {constructPaymentIntentApiPayload} from '@/internal/common/utils';
import Form from '@/utils/payments/form/Form';

interface GenDeviceDataJWTResponse {
  jwt: string;
  bin?: string;
}

export default class WorldPay3DSHandler extends AbstractThreeDSecureHandler {
  private DDC_CARDINAL_BASE_URL: string = Helpers.isTestSite()
    ? 'https://centinelapistag.cardinalcommerce.com'
    : 'https://centinelapi.cardinalcommerce.com';

  private DDC_COLLECT_ACTION_TIMEOUT: number = 60 * 1000;

  validate() {
    const hasRawCard = !!this.paymentInfo.card;
    const hasReferenceId = !!this.getReferenceId();
    const hasCbToken = !!this.paymentInfo.cbToken;
    const hasCardComponent = !!this.paymentInfo.cardComponent;
    const hadPaymentComponent = !!this.paymentInfo.paymentComponent;

    if (!hasRawCard && !hasReferenceId && !hasCbToken && !hasCardComponent && !hadPaymentComponent) {
      throw new CbError(Errors.missingWorldPayPaymentInfo);
    }

    if (hasRawCard) {
      validateRawCardDetails(this.paymentInfo.card);

      if (!this.paymentInfo.card.firstName && !this.paymentInfo.card.lastName) {
        throw new CbError(Errors.missingWorldPayCardHolderInfo);
      }
    }

    if (!this.hasAdditionalData() || !this.paymentInfo.additionalData.email) {
      throw new CbError(Errors.missingWorldPayEmailInfo);
    }

    return true;
  }

  handlePayment() {
    this.genDeviceDataJWT()
      .then((result: GenDeviceDataJWTResponse) => {
        if (!result.bin && this.paymentInfo.card) {
          result.bin = this.paymentInfo.card.number.replace(/\D/g, '');
        }
        return this.doDeviceDataCollection(result);
      })
      .then((sessionId) => this.handlePaymentFlow(this.getConfirmReqPayload(sessionId)));
  }

  handlePaymentFlow(payload) {
    return this.confirmPayment(payload)
      .catch((err) => {
        this.callError(err instanceof CbError ? err : new CbError(err));
      })
      .finally(() => {
        this.removeIframe();
      });
  }

  handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_CHALLENGE:
        return this.doChallenge(paymentAttempt).then((data: any) => {
          this.setPaymentIntent(data.payment_intent);
          return this.handlePaymentAttempt(this.getPaymentAttempt());
        });
      case PaymentAttemptStatus.AUTHORIZED:
        this.callSuccess();
        return Promise.resolve(true);
      case PaymentAttemptStatus.REFUSED:
      default:
        throw this.intentError();
    }
  }

  getConfirmReqPayload(sessionId?: string) {
    let payload: any = {};
    const {card, cbToken, cardComponent, paymentComponent} = this.paymentInfo;
    if (card) {
      payload = {paymentMethod: card};
    } else if (cbToken) {
      payload = {cbToken};
    } else if (cardComponent) {
      payload = {cardComponent};
    } else if (paymentComponent) {
      payload = {paymentComponent};
    }

    payload.additionalInfo = sessionId ? {dfReferenceId: sessionId} : {};
    if (this.hasAdditionalData()) {
      payload.cardBillingAddress = this.getCardBillingAddress();
      payload.billingAddress = this.getCardBillingAddress();
      payload.email = this.paymentInfo.additionalData.email;
      payload.shippingAddress = this.getShippingAddress();
    }
    return payload;
  }

  private genDeviceDataJWT(): Promise<any> {
    let payload: any = constructPaymentIntentApiPayload(this.getPaymentIntent());
    if (this.paymentInfo.cbToken) {
      payload.cbToken = this.paymentInfo.cbToken;
    }
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.GenerateDeviceDataJWT,
          data: payload,
        },
        Ids.MASTER_FRAME,
        {timeout: 120000}
      )
    );
  }

  doDeviceDataCollection(result: GenDeviceDataJWTResponse): Promise<any> {
    return new Promise((resolve, reject) => {
      window.addEventListener(
        'message',
        (event) => {
          /**
           * This domain changes with every environment. This origin value will be the CentinelAPI domain
           * event message sample: {MessageType: 'profile.completed', SessionId: "SESSION_ID", Status: true}
           */
          if (event.origin === this.DDC_CARDINAL_BASE_URL) {
            let data = JSON.parse(event.data);
            if (data !== undefined && data.MessageType === 'profile.completed' && data.Status) {
              resolve(data.SessionId);
              clearTimeout(timeout);
            }
          }
        },
        false
      );
      const form = this.createDeviceDataCollectionForm(result.jwt, result.bin);
      form.submit();
      const timeout = setTimeout(() => {
        reject(new CbError('timeout'));
      }, this.DDC_COLLECT_ACTION_TIMEOUT);
    });
  }

  doChallenge(paymentAttempt: PaymentAttempt) {
    const result = paymentAttempt.action_payload;
    const form = this.createStepUpForm(result.challengeJWT);
    form.submit();
    this.openIframe();
    setTimeout(() => this.hideIframeLoader());
    /**
     * hiding iframe loader in zero timeout since there is no way to find
     * when challenge window gets loaded as many intermediate frames get loaded
     * and we can't rely on iframe onload event.
     */

    return this.pollFor3DSCompletion().then((data) => {
      // Removes or closes the iframe
      this.removeIframe();
      return data;
    });
  }

  private createDeviceDataCollectionForm(jwt: string, bin: string) {
    const targetIframe = this.createHiddenIframe('worldpayCardinalDeviceDataForm');
    const deviceDataForm = new Form();
    deviceDataForm.target = targetIframe.name;
    deviceDataForm.action = `${this.DDC_CARDINAL_BASE_URL}/V1/Cruise/Collect`;
    deviceDataForm.addInput({
      JWT: jwt,
      Bin: bin,
    });
    document.body.appendChild(targetIframe);
    deviceDataForm.insert(document.body);
    return deviceDataForm;
  }

  private createStepUpForm(jwt: string) {
    const frame = this.createIframe();
    const stepUpForm = new Form();
    stepUpForm.target = frame.name;
    stepUpForm.action = `${this.DDC_CARDINAL_BASE_URL}/V2/Cruise/StepUp`;
    stepUpForm.addInput({
      JWT: jwt,
    });
    stepUpForm.insert(document.body);
    return stepUpForm;
  }
}
