import {CbError} from '@/hosted_fields/common/errors';
import Helpers from '@/helpers';
import AbstractThreeDSecureHandler from '../abstract';
import {PaymentAttempt, PaymentAttemptStatus} from '@/plugins/three_domain_secure/types';
import Form from '@/utils/payments/form/Form';

export default class CybersourceHandler extends AbstractThreeDSecureHandler {
  private DEVICE_FINGER_PRINTING_DOMAIN: string = Helpers.isTestSite()
    ? 'https://centinelapistag.cardinalcommerce.com'
    : 'https://centinelapi.cardinalcommerce.com';

  private DEVICE_FINGER_PRINTING_TIMEOUT: number = 60 * 1000;
  private iframe: HTMLIFrameElement;

  handlePayment() {
    this.handlePaymentFlow(this.getConfirmReqPayload());
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

  validate() {
    const paymentIntent = this.getPaymentIntent();
    if (paymentIntent && paymentIntent.reference_id) {
      return true;
    }
    const additionalData = this.paymentInfo.additionalData;
    return !!(additionalData && additionalData.billingAddress && additionalData.email);
  }

  handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_IDENTIFICATION: {
        return this.doDeviceFingerprinting(paymentAttempt).then((data) => this.confirmPayment(data));
      }
      case PaymentAttemptStatus.REQUIRES_CHALLENGE: {
        return this.doChallenge(paymentAttempt).then((data) => this.confirmPayment(data));
      }
      case PaymentAttemptStatus.AUTHORIZED: {
        this.callSuccess();
        return Promise.resolve(true);
      }

      case PaymentAttemptStatus.REFUSED:
      default: {
        throw this.intentError();
      }
    }
  }

  setIframeContent(html: string) {
    this.iframe.src = `data:text/html;charset=utf-8,${encodeURI(html)}`;
  }

  getConfirmReqPayload() {
    const {card, cbToken, additionalData, cardComponent, paymentComponent} = this.paymentInfo;
    const payload = {
      email: additionalData.email,
    };
    const paymentIntent = this.getPaymentIntent();
    if (paymentIntent && paymentIntent.reference_id) {
      return payload;
    }
    const billingAddress = this.getCardBillingAddress();
    payload['cardBillingAddress'] = Object.assign({}, billingAddress, {
      country: billingAddress && billingAddress.countryCode,
    });
    if (cbToken) {
      payload['cbToken'] = cbToken;
    } else if (cardComponent) {
      payload['cardComponent'] = cardComponent;
    } else if (paymentComponent) {
      payload['paymentComponent'] = paymentComponent;
    } else {
      payload['paymentMethod'] = card;
    }
    return payload;
  }

  doDeviceFingerprinting(paymentAttempt: PaymentAttempt): Promise<any> {
    this.kvl({
      action: 'cybersource_3ds_log',
      method: 'doDeviceFingerprinting',
      resp_status: 'success',
    });
    const rawResponse = paymentAttempt.action_payload;

    return new Promise((resolve, reject) => {
      window.addEventListener(
        'message',
        (event) => {
          /**
           * This domain changes with every environment. This origin value will be the CentinelAPI domain
           * event message sample: {MessageType: 'profile.completed', SessionId: "SESSION_ID", Status: true}
           */
          if (event.origin === this.DEVICE_FINGER_PRINTING_DOMAIN) {
            let data = JSON.parse(event.data);
            if (data !== undefined && data.MessageType === 'profile.completed' && data.Status) {
              resolve(this.getConfirmReqPayload());
              clearTimeout(timeout);
            }
          }
        },
        false
      );

      const form = this.createDeviceDataCollectionForm(rawResponse.cardinalJwt);
      form.submit();

      const timeout = setTimeout(() => {
        reject(new CbError('timeout'));
      }, this.DEVICE_FINGER_PRINTING_TIMEOUT);
    });
  }

  private createDeviceDataCollectionForm(jwt: string) {
    const targetIframe = this.createHiddenIframe('cybersourceCardinalDeviceDataForm');
    const deviceDataForm = new Form();
    deviceDataForm.target = targetIframe.name;
    deviceDataForm.action = `${this.DEVICE_FINGER_PRINTING_DOMAIN}/V1/Cruise/Collect`;
    deviceDataForm.addInput({
      JWT: jwt,
    });
    document.body.appendChild(targetIframe);
    deviceDataForm.insert(document.body);
    return deviceDataForm;
  }

  private createStepUpForm(jwt: string, stepUpUrl: string) {
    const frame = this.createIframe();
    const stepUpForm = new Form();
    stepUpForm.target = frame.name;
    stepUpForm.action = stepUpUrl;
    stepUpForm.addInput({
      JWT: jwt,
    });

    stepUpForm.insert(document.body);
    return stepUpForm;
  }

  doChallenge(paymentAttempt: PaymentAttempt) {
    this.kvl({
      action: 'cybersource_3ds_log',
      method: 'doChallenge',
      resp_status: 'success',
    });
    const rawResponse: {
      transactionJwt: string;
      stepUpUrl: string;
    } = paymentAttempt.action_payload;

    const form = this.createStepUpForm(rawResponse.transactionJwt, rawResponse.stepUpUrl);
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

      this.kvl({
        action: 'cybersource_3ds_log',
        method: 'pollFor3DSCompletion',
        data: JSON.stringify({
          txn_id: data && data['TransactionId'],
        }),
        resp_status: 'success',
      });
      return Object.assign({}, this.getConfirmReqPayload(), {
        transactionId: data['TransactionId'],
      });
    });
  }
}
