export interface ApiInterface {
  name: string;
  actions: ApiActionInterface[];
}

export interface ApiActionInterface {
  name: string;
  method: 'get' | 'post';
  endpoint: ((param: any) => string) | string;
  headers?: any;
  jsApi?: boolean;
  requireCurrency?: boolean;
  static?: boolean;
  recaptcha?: boolean;
  skipBusinessEntityId?: boolean;
  skipBrandId?: boolean;
}

export interface ApiClientInterface {
  _config: ApiConfigInterface;
  getDomain(): string;
  getStaticDomain(): string;
  addApis(apis: ApiInterface[]);
  [key: string]: any;
}

export interface ApiConfigInterface {
  site: string;
  publishableKey?: string;
  hostName?: string;
  customDomain?: string;
}

export const BUSINESS_ENTITY_HEADER = 'chargebee-business-entity-id';
export const BRAND_ID_HEADER = 'chargebee-brand-id';
export const BROWSER_FINGERPRINT_HEADER = 'cb-browser-fingerprint';
export const HARDWARE_FINGERPRINT_HEADER = 'cb-hardware-fingerprint';
export const DEVICE_ID_HEADER = 'cb-device-id';
