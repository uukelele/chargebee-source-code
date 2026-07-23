import {ApiInterface} from '@/plugins/core/api/interface';

const apis: ApiInterface[] = [
  {
    name: 'config',
    actions: [
      {
        name: 'retrieve',
        method: 'get',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
        endpoint: '/api/internal/component/retrieve_config',
      },
    ],
  },
  {
    name: 'paypal_payment_intent',
    actions: [
      {
        name: 'confirm',
        method: 'post',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/json',
        },
        endpoint: '/api/internal/payment_intents/confirm',
        recaptcha: true,
      },
      // GATEENGG-26993: Creates a PayPal vault setup token for the new Vault ID flow.
      {
        name: 'create_vault_setup_token',
        method: 'post',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/json',
        },
        endpoint: '/api/internal/payment_intents/paypal_vault_setup_token',
      },
    ],
  },
];

export default apis;
