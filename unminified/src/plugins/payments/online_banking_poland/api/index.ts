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
    name: 'online_banking_poland_config',
    actions: [
      {
        name: 'get_gateway_details',
        method: 'post',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
        endpoint: '/api/internal/payment_intents/get_gw_payment_method_meta',
      },
    ],
  },
  {
    name: 'payment_intent',
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
      {
        name: 'fetch_gateway_credential',
        method: 'get',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
        endpoint: '/api/internal/payment_intents/fetch_gateway_public_credential',
      },
    ],
  },
];

export default apis;
