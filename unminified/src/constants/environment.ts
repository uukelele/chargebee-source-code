import {ComponentImplEnvironmentConfigurationMap} from '@/components/types';

export default class EnvConstants {
  // @ts-ignore
  static APP_DOMAIN = __APP_DOMAIN__;
  // @ts-ignore
  static readonly JS_DOMAIN = __JS_DOMAIN__;
  // @ts-ignore
  static readonly STATIC_DOMAIN = __STATIC_DOMAIN__;
  // @ts-ignore
  static readonly COMPONENTS: ComponentImplEnvironmentConfigurationMap = __COMPONENTS__;
  // @ts-ignore
  static readonly ASSET_PATH = `${__JS_DOMAIN__}${__PUBLIC_PATH__}`;
  // @ts-ignore
  static readonly DEBUG_MODE = __DEBUG_MODE__;
  // @ts-ignore
  static readonly ENVIRONMENT = __ENVIRONMENT__;
  // @ts-ignore
  static readonly PRICING_TABLE_JS = __PRICING_TABLE_JS__;
  // @ts-ignore
  static readonly RETENTION_JS = __RETENTION_JS__;
}

export function isDev(): boolean {
  return process.env.NODE_ENV !== 'production';
}

export function debugMode(): boolean {
  return isDev() && EnvConstants.DEBUG_MODE;
}
