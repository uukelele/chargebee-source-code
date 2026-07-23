import ThreeDSecureHandler from '@/extensions/three_domain_secure/index';
import {CbError} from '@/hosted_fields/common/errors';
import {ConfirmApiInputPayload} from '@/extensions/three_domain_secure/common/types';
import Base3DSHandler from './index';
import {GatewayConfig, Base3DSConfig} from './types';

export default class UnifiedGatewaySDKHandler extends Base3DSHandler {
  private sdkInstance: any;
  gatewayConfig: GatewayConfig;

  constructor(parent: ThreeDSecureHandler, config: Base3DSConfig, gatewayConfig: GatewayConfig) {
    super(parent, config);
    this.gatewayConfig = gatewayConfig;
  }

  async handlePayment(): Promise<void> {
    try {
      // Load SDK if needed
      if (this.gatewayConfig.loadSDKScript) {
        await this.gatewayConfig.loadSDKScript();
      }

      // Create SDK instance if needed
      if (this.gatewayConfig.createSDKInstance) {
        this.sdkInstance = await this.gatewayConfig.createSDKInstance();
      }

      // Handle the payment flow
      const confirmApiPayload: ConfirmApiInputPayload = await this.gatewayConfig.getConfirmApiPayload(
        this.paymentInfo,
        this.getPaymentIntent()
      );
      return this.confirmPayment(confirmApiPayload);
    } catch (error) {
      this.closeChallengeWindow();
      this.callError(this.sanitizeError(error));
    }
  }

  protected getSDKInstance(): any {
    return this.sdkInstance;
  }

  sanitizeError(error: any): CbError {
    if (!error) return new CbError({});
    const gateway = this.config.gateway;
    return new CbError(
      {
        name: error.code || `${gateway}_ERROR`,
        type: 'gateway_error',
        message: error.message || `An error occurred with ${gateway} payment processing`,
      },
      error
    );
  }
}
