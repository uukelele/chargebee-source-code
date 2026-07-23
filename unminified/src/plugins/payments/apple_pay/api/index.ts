import {ApiInterface} from '@/plugins/core/api/interface';

const apis: ApiInterface[] = [
  {
    name: 'apple_pay',
    actions: [
      {
        name: 'validate_apple_pay_session',
        method: 'post',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
        endpoint: '/api/internal/apple_pay/validate_apple_pay_session',
      },
    ],
  },
];

export default apis;
