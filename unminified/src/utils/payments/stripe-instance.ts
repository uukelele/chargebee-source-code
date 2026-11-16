/**
 * Creates a Stripe.js v3 instance. `apiVersion` is the `stripe_js_api_version` sent by the backend
 * only when the version pin is enabled for the environment. Without it (and without options) this
 * is the plain `Stripe(publishableKey)` call, so the account's default Stripe API version applies.
 */
export const createStripe = (publishableKey: string, apiVersion?: string, options?: {[key: string]: any}): any => {
  const stripeOptions = apiVersion ? {...options, apiVersion} : options;
  return stripeOptions ? window['Stripe'](publishableKey, stripeOptions) : window['Stripe'](publishableKey);
};
