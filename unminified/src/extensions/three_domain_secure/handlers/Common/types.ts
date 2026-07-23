import {ConfirmApiInputPayload, PaymentInfo, PaymentIntent} from '@/extensions/three_domain_secure/common/types';

export const TokenizationType = {
  Client: 'client',
  Server: 'server',
};

export type TokenizationTypeEnum = (typeof TokenizationType)[keyof typeof TokenizationType];

export interface Base3DSConfig {
  gateway: string;
  supported_flows: string[];
  challenge_window?: 'iframe' | 'tab';
  tokenization_type: TokenizationTypeEnum;
  cardHolderInfoRequired: boolean;
}

export interface GatewayConfig {
  getConfirmApiPayload?: (paymentInfo: PaymentInfo, paymentIntent: PaymentIntent) => Promise<ConfirmApiInputPayload>;
  createSDKInstance?: () => Promise<any>;
  loadSDKScript?: () => Promise<void>;
}
