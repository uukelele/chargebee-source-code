import {ApiInterface} from '@/plugins/core/api/interface';

const apis: ApiInterface[] = [
  {
    name: 'amazon_payments',
    actions: [
      {
        name: 'generate_amazon_pay_button_signature',
        method: 'post',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
        endpoint: '/api/internal/amazon_pay/generate_button_signature',
      },
    ],
  },
];

export default apis;
