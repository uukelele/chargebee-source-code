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
    name: 'bancontact_payment_intent',
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
];

export default apis;
