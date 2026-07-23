import {ResponseInnerMessage} from '@/hosted_fields/common/types';
import PluginInterface from '@/plugins/core/interface';
import {RetryErrorData} from '@/utils/retry-mechanism';

export enum CaptchaProviderName {
  GOOGLE_RECAPTCHA = 'google_recaptcha',
  TURNSTILE = 'turnstile',
  HCAPTCHA = 'hcaptcha',
}

export type RecaptchaOptions = {
  siteKey: string;
  provider?: CaptchaProviderName;
  sdkEndpoint?: string;

  // Specific to Google. Added for backwards compatibility
  isGlobalRecaptcha?: boolean;
  hideBanner?: boolean;
  onError?: (error) => void;
  logToKVL?: (error: RetryErrorData) => Promise<void>;
};

export interface CaptchaPluginInterface extends PluginInterface {
  options: RecaptchaOptions;
  initialize(options: RecaptchaOptions): Promise<ResponseInnerMessage>;
  generateToken(action?: string): Promise<string | undefined>;
  getErrors: () => RetryErrorData[];
}
