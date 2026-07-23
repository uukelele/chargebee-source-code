import RawCard3DSHandler from '../RawCard3DSHandler';
import AbstractThreeDSecureHandler from '../../abstract';
import ThreeDSecureHandler from '@/extensions/three_domain_secure/index';
import UnifiedGatewaySDKHandler from '../UnifiedGatewaySDKHandler';
import {Base3DSConfig, GatewayConfig, TokenizationType} from '../types';

export default class HandlerFactory {
  private config: Base3DSConfig;

  constructor(config: Base3DSConfig) {
    this.config = config;
  }

  createHandler(parent: ThreeDSecureHandler): Promise<AbstractThreeDSecureHandler> {
    return new Promise((resolve, reject) => {
      try {
        let handler: AbstractThreeDSecureHandler;

        if (this.config.tokenization_type === TokenizationType.Server) {
          // Create a raw card handler
          handler = new RawCard3DSHandler(parent, this.config);
        } else if (this.config.tokenization_type === TokenizationType.Client) {
          // Create a unified gateway handler
          if (!this.config.gateway) {
            throw new Error('Gateway name is required for unified gateway handler');
          }

          // Get the gateway config
          const gatewayConfig = this.getGatewayConfig(this.config.gateway);
          if (!gatewayConfig) {
            throw new Error(`Gateway config not found for ${this.config.gateway}`);
          }

          // Create the unified handler with the gateway config
          handler = new UnifiedGatewaySDKHandler(parent, this.config, gatewayConfig);
        } else {
          throw new Error(`Invalid handler type: ${this.config.tokenization_type}`);
        }

        resolve(handler);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get the gateway config for the specified gateway
   */
  private getGatewayConfig(gateway: string): GatewayConfig | null {
    switch (gateway) {
      case 'bluesnap':
        // Import the Braintree gateway config
        const {BluesnapGatewayConfig} = require('../../bluesnap/BluesnapGatewayConfig');
        return BluesnapGatewayConfig;
      default:
        return null;
    }
  }
}
