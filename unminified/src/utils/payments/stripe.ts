import {loadScriptUsingPredicate} from '@/extensions/three_domain_secure/common/utils';
import {CbError} from '@/hosted_fields/common/errors';
import {fetchGatewayCredential} from '@/utils/payments/gateway-credential';

export const getStripe = (): any => {
  return window['Stripe'];
};

export const getStripeV3 = (paymentIntent): any => {
  if (window['stripeV3']) {
    return Promise.resolve(window['stripeV3']);
  } else {
    return checkNLoadScript(paymentIntent);
  }
};

export const isStripeV3Available = () => {
  let stripe = getStripe();
  return stripe && (stripe.version == 3 || stripe.StripeV3);
};

export const checkNLoadScript = (paymentIntent): Promise<any> => {
  let promises: Promise<any>[] = [
    fetchGatewayCredential(paymentIntent),
    loadScriptUsingPredicate('https://js.stripe.com/v3/', () => {
      return !!isStripeV3Available();
    }),
  ];

  return new Promise<void>((resolve, reject) => {
    Promise.all(promises)
      .then((args) => {
        window['stripeV3'] = getStripe()(args[0].publishable_key);
        resolve(window['stripeV3']);
      })
      .catch((error) => {
        reject(new CbError(error));
      });
  });
};
