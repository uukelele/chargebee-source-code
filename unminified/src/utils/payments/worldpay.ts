import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import {Master as M} from '@/hosted_fields/common/enums';
import Ids from '@/constants/ids';
import {constructPaymentIntentApiPayload} from '@/internal/common/utils';
import {CbError} from '@/hosted_fields/common/errors';
import Helpers from '@/helpers';
import Form from '@/utils/payments/form/Form';

// Worldpay uses PAYMENT_GATEWAY tokenization so it cannot determine whether the
// underlying card is PAN_ONLY or CRYPTOGRAM_3DS. Worldpay therefore requires
// 3DS parameters in ALL Google Pay transactions and may return REQUIRES_CHALLENGE.

const DDC_TIMEOUT = 60 * 1000;

export function getWorldpayCardinalUrl(): string {
  return Helpers.isTestSite()
    ? 'https://centinelapistag.cardinalcommerce.com'
    : 'https://centinelapi.cardinalcommerce.com';
}

function genDDCJWT(handler: any): Promise<{jwt: string; bin?: string}> {
  return IframeClientLoader.then((cbIframeClient) =>
    cbIframeClient.send(
      {
        action: M.Actions.GenerateDeviceDataJWT,
        data: constructPaymentIntentApiPayload(handler.getPaymentIntent()),
      },
      Ids.MASTER_FRAME,
      {timeout: 120000}
    )
  );
}

export function worldpayGPayDDC(handler: any): Promise<string> {
  return genDDCJWT(handler).then((result: {jwt: string; bin?: string}) => {
    return new Promise<string>((resolve, reject) => {
      const cardinalUrl = getWorldpayCardinalUrl();
      const messageHandler = (event: MessageEvent) => {
        if (event.origin === cardinalUrl) {
          try {
            const data = JSON.parse(event.data);
            if (data && data.MessageType === 'profile.completed' && data.Status) {
              window.removeEventListener('message', messageHandler);
              clearTimeout(timeout);
              resolve(data.SessionId);
            }
          } catch (_) {
            /* ignore non-JSON messages */
          }
        }
      };
      window.addEventListener('message', messageHandler);
      const frame = handler.createHiddenIframe('worldpayGPayDDCFrame');
      document.body.appendChild(frame);
      const ddcForm = new Form();
      ddcForm.target = frame.name;
      ddcForm.action = `${cardinalUrl}/V1/Cruise/Collect`;
      ddcForm.addInput({JWT: result.jwt, Bin: result.bin || ''});
      ddcForm.insert(document.body);
      ddcForm.submit();
      const timeout = setTimeout(() => {
        window.removeEventListener('message', messageHandler);
        reject(new CbError({name: 'WORLDPAY_DDC_TIMEOUT', message: 'Device data collection timed out'}));
      }, DDC_TIMEOUT);
    });
  });
}

function createStepUpForm(handler: any, jwt: string) {
  const cardinalUrl = getWorldpayCardinalUrl();
  const frame = handler.createIframe();
  const stepUpForm = new Form();
  stepUpForm.target = frame.name;
  stepUpForm.action = `${cardinalUrl}/V2/Cruise/StepUp`;
  stepUpForm.addInput({JWT: jwt});
  stepUpForm.insert(document.body);
  return stepUpForm;
}

function pollWorldpay3DSResult(handler: any): Promise<any> {
  return IframeClientLoader.then((cbIframeClient) =>
    cbIframeClient.send(
      {
        action: M.Actions.PollPaymentIntent3DSResult,
        data: {paymentIntentId: handler.getPaymentIntent().id},
      },
      Ids.MASTER_FRAME,
      {timeout: 10 * 60 * 1000}
    )
  );
}

export function worldpayHandleRequiresChallenge(handler: any, challengeJWT: string): Promise<any> {
  const form = createStepUpForm(handler, challengeJWT);
  form.submit();
  handler.openIframe();
  setTimeout(() => handler.hideIframeLoader());
  return pollWorldpay3DSResult(handler)
    .then((data: any) => {
      handler.removeIframe();
      if (data && data.payment_intent) {
        handler.setPaymentIntent(data.payment_intent);
        return handler.handlePaymentAttempt(handler.getPaymentAttempt());
      }
      return handler.confirmPayment();
    })
    .catch((err) => {
      handler.removeIframe();
      throw err;
    });
}
