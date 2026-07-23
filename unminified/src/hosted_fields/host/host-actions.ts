import Assert from '@/helpers/asserts';
import ComponentRegistrar from '@/hosted_fields/host/component-registrar';
import actionHolder from '@/hosted_fields/common/holder';
import {ActionInnerMessage, ResponseInnerMessage} from '@/hosted_fields/common/types';
import {Host, Master as M} from '@/hosted_fields/common/enums';
import Errors from '@/hosted_fields/common/errors';
import t from '@/hosted_fields/common/locale';
import {safeGet, jsonify} from '@/utils/utility-functions';
import Ids from '@/constants/ids';
import {CbIframeClientInterface} from '@/hosted_fields/host/cb-iframe-client';
import {debugMode} from '@/constants/environment';

export default (client: CbIframeClientInterface) => {
  actionHolder.registerAction(Host.Actions.TriggerEvent, {
    handle(message: ActionInnerMessage) {
      const component = ComponentRegistrar.registry[message.data.frame];
      if (debugMode()) {
        // Component not found occurs when component is de-registered and events are sent from the detached iframe. These errors can be safely ignored.
        Assert.notTrue(() => !!component, t(Errors.componentNotFound));
      }

      // Handle events only if component is registered
      if (!!component) {
        component.delegateEvent(message.data);
      }
      return new Promise((resolve, reject) => resolve({acknowledged: true}));
    },
  });

  actionHolder.registerAction(Host.Actions.ReceiveStatusBroadcast, {
    // !TODO will change and error event be passed using this??
    handle(message: ActionInnerMessage) {
      const component = ComponentRegistrar.registry[message.data.frame];
      if (debugMode()) {
        Assert.notTrue(() => !!component, t(Errors.componentNotFound));
      }
      if (!!component) {
        component.delegateEvent(message.data);
      }
      return new Promise((resolve, reject) => resolve({acknowledged: true}));
    },
  });
  actionHolder.registerAction(Host.Actions.setTestCards, {
    handle(message: ActionInnerMessage) {
      const component = ComponentRegistrar.registry[message.data.frame];
      if (component) {
        component.delegateEvent(message.data);
      }
      return Promise.resolve({acknowledged: true});
    },
  });

  actionHolder.registerAction(Host.Actions.SetPaymentIntent3DSResult, {
    handle: (message: ActionInnerMessage): Promise<ResponseInnerMessage> => {
      return client.send(
        {
          action: M.Actions.SetPaymentIntent3DSResult,
          data: message.data,
        },
        Ids.MASTER_FRAME
      );
    },
  });

  actionHolder.registerAction(Host.Actions.SetAdyen3DS1VerificationResult, {
    handle: (message: ActionInnerMessage): Promise<ResponseInnerMessage> => {
      return client.send(
        {
          action: M.Actions.SetAdyen3DS1VerificationResult,
          data: message.data,
        },
        Ids.MASTER_FRAME
      );
    },
  });

  actionHolder.registerAction(M.Actions.SetCheckoutCom3DSVerificationResult, {
    handle: (message: ActionInnerMessage): Promise<ResponseInnerMessage> => {
      return client.send(
        {
          action: M.Actions.SetCheckoutCom3DSVerificationResult,
          data: message.data,
        },
        Ids.MASTER_FRAME
      );
    },
  });

  actionHolder.registerAction(M.Actions.SetCybersource3DSVerificationResult, {
    handle: (message: ActionInnerMessage): Promise<ResponseInnerMessage> => {
      return client.send(
        {
          action: M.Actions.SetCybersource3DSVerificationResult,
          data: message.data,
        },
        Ids.MASTER_FRAME
      );
    },
  });

  actionHolder.registerAction(Host.Actions.SetAdyenIDealVerificationResult, {
    handle: (message: ActionInnerMessage): Promise<ResponseInnerMessage> => {
      try {
        client.send(
          {
            action: M.Actions.CaptureKVL,
            data: {
              action: 'iDeal_set_verification_result',
              ...jsonify(message.data),
            },
          },
          Ids.MASTER_FRAME
        );
      } catch (e) {}

      return client.send(
        {
          action: M.Actions.SetAdyenIDealVerificationResult,
          data: message.data,
        },
        Ids.MASTER_FRAME
      );
    },
  });

  actionHolder.registerAction(Host.Actions.SetStripeIDealVerificationResult, {
    handle: (message: ActionInnerMessage): Promise<ResponseInnerMessage> => {
      try {
        client.send(
          {
            action: M.Actions.CaptureKVL,
            data: {
              action: 'iDeal_set_verification_result',
              ...jsonify(message.data),
            },
          },
          Ids.MASTER_FRAME
        );
      } catch (e) {}

      return client.send(
        {
          action: M.Actions.SetStripeIDealVerificationResult,
          data: message.data,
        },
        Ids.MASTER_FRAME
      );
    },
  });

  actionHolder.registerAction(Host.Actions.SetAdyenSofortVerificationResult, {
    handle: (message: ActionInnerMessage): Promise<ResponseInnerMessage> => {
      return client.send(
        {
          action: M.Actions.SetAdyenSofortVerificationResult,
          data: message.data,
        },
        Ids.MASTER_FRAME
      );
    },
  });

  actionHolder.registerAction(Host.Actions.SetAdyenBancontactVerificationResult, {
    handle: (message: ActionInnerMessage): Promise<ResponseInnerMessage> => {
      return client.send(
        {
          action: M.Actions.SetAdyenBancontactVerificationResult,
          data: message.data,
        },
        Ids.MASTER_FRAME
      );
    },
  });

  actionHolder.registerAction(Host.Actions.SetAdyenGiropayVerificationResult, {
    handle: (message: ActionInnerMessage): Promise<ResponseInnerMessage> => {
      return client.send(
        {
          action: M.Actions.SetAdyenGiropayVerificationResult,
          data: message.data,
        },
        Ids.MASTER_FRAME
      );
    },
  });

  actionHolder.registerAction(Host.Actions.SetAdyenDotpayVerificationResult, {
    handle: (message: ActionInnerMessage): Promise<ResponseInnerMessage> => {
      return client.send(
        {
          action: M.Actions.SetAdyenDotpayVerificationResult,
          data: message.data,
        },
        Ids.MASTER_FRAME
      );
    },
  });

  actionHolder.registerAction(Host.Actions.SetFrameLoaded, {
    handle: (message: ActionInnerMessage): Promise<ResponseInnerMessage> => {
      // @ts-ignore
      window[`cb-${message.data.frame}-loaded`] = true;
      return Promise.resolve({acknowledged: true});
    },
  });

  actionHolder.registerAction(Host.Actions.CaptureKVL, {
    handle: (message: ActionInnerMessage): Promise<ResponseInnerMessage> => {
      return client.send(
        {
          action: M.Actions.CaptureKVL,
          data: message.data,
        },
        Ids.MASTER_FRAME
      );
    },
  });

  actionHolder.registerAction(Host.Actions.CaptureException, {
    handle: (message: ActionInnerMessage): Promise<ResponseInnerMessage> => {
      return client.send(
        {
          action: M.Actions.CaptureException,
          data: message.data,
        },
        Ids.MASTER_FRAME
      );
    },
  });

  actionHolder.registerAction(Host.Actions.SetAuthToken, {
    handle: (message: ActionInnerMessage): Promise<ResponseInnerMessage> => {
      return client.send(
        {
          action: M.Actions.SetHpData,
          data: {
            jwt: safeGet(message, 'data.jwt') || '',
          },
        },
        Ids.MASTER_FRAME
      );
    },
  });

  actionHolder.registerAction(Host.Actions.SetCustomerHandle, {
    handle: (message: ActionInnerMessage): Promise<ResponseInnerMessage> => {
      return client.send(
        {
          action: M.Actions.SetHpData,
          data: {
            customer_handle: safeGet(message, 'data.customer_handle') || '',
          },
        },
        Ids.MASTER_FRAME
      );
    },
  });

  actionHolder.registerAction(Host.Actions.SetPreviewPortalEmail, {
    handle: (message: ActionInnerMessage): Promise<ResponseInnerMessage> => {
      const email = safeGet(message, 'data.email') || '';
      return client.send(
        {
          action: M.Actions.SetHpData,
          data: {
            preview_portal_email: email,
          },
        },
        Ids.MASTER_FRAME
      );
    },
  });

  actionHolder.registerAction(Host.Actions.GetPreviewPortalEmail, {
    handle: (message: ActionInnerMessage): Promise<ResponseInnerMessage> => {
      return client
        .send(
          {
            action: M.Actions.GetHpData,
            data: {
              param: 'preview_portal_email',
            },
          },
          Ids.MASTER_FRAME
        )
        .then((data: any) => {
          const preview_portal_email = data.preview_portal_email;
          const portalFrame: HTMLIFrameElement = <HTMLIFrameElement>document.getElementById('cb-frame');
          if (portalFrame && preview_portal_email) {
            portalFrame.contentWindow.postMessage(
              {
                action: 'setPreviewPortalEmail',
                referrer: 'chargebeejs',
                data: {
                  preview_portal_email,
                },
              },
              '*'
            );
          }
          return data;
        });
    },
  });

  actionHolder.registerAction(Host.Actions.ShowFrame, {
    handle: (message: ActionInnerMessage): Promise<ResponseInnerMessage> => {
      (<HTMLElement>document.querySelector(`iframe[name=${message.data}]`)).style.display = 'block';
      return new Promise((resolve, reject) => resolve({acknowledged: true}));
    },
  });

  actionHolder.registerAction(Host.Actions.HideFrame, {
    handle: (message: ActionInnerMessage): Promise<ResponseInnerMessage> => {
      (<HTMLElement>document.querySelector(`iframe[name=${message.data}]`)).style.display = 'none';
      return new Promise((resolve, reject) => resolve({acknowledged: true}));
    },
  });
};
