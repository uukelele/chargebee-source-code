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
    name: 'direct_debit_payment_intent',
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
    ],
  },
  {
    name: 'plaid_config',
    actions: [
      {
        name: 'get_link_token',
        method: 'get',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
        endpoint: '/api/internal/payment_intents/plaid_link_token',
      },
      {
        name: 'get_gw_payment_method_config',
        method: 'get',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
        endpoint: '/api/internal/payment_intents/get_gw_payment_method_config',
      },
    ],
  },
];

export default apis;
