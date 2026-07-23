export namespace Adyen {
  export type BrowserFingerprint = {
    origin?: string;
    browserInfo?: {
      colorDepth: number;
      javaEnabled: boolean;
      language: string;
      screenHeight: number;
      screenWidth: number;
      timeZoneOffset: number;
      userAgent: string;
    };
  };

  export enum WebComponent {
    Fingerprint = 'threeDS2DeviceFingerprint',
    Challenge = 'threeDS2Challenge',
    IDeal = 'ideal',
  }

  export type BillingAddress = {
    city?: string;
    country?: string;
    houseNumberOrName?: string;
    postalCode?: string;
    stateOrProvince?: string;
    street?: string;
  };

  export type Error = {
    status?: string;
    errorCode?: string;
    message?: string;
    errorType?: string;
  };
}
