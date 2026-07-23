export type BrowserFingerprint = {
  origin?: string;
  browserInfo?: BrowserDetails;
};

export type BrowserInfoFingerprintData = {
  userAgent: string;
  language: string;
  languages: readonly string[] | string[];
  timezone: string;
  cookieEnabled: boolean;
};

export type HardwareFingerprintData = {
  platform: string;
  hardwareConcurrency: number;
  deviceMemory?: number;
  maxTouchPoints: number;
  colorDepth: number;
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
};

export type BrowserFingerprintHeaders = {
  browserFingerprint: string;
  hardwareFingerprint: string;
};

export type BrowserDetails = {
  colorDepth: number;
  javaEnabled: boolean;
  language: string;
  screenHeight: number;
  screenWidth: number;
  timeZoneOffset: number;
  userAgent: string;
};

const Utils = {
  getOwnerEmail(paymentInfo): string {
    return paymentInfo && paymentInfo.userEmail;
  },

  getPaymentMethodUserDetails(paymentInfo): any {
    let paymentMethod;
    if (paymentInfo && paymentInfo.userName) {
      const nameArray = paymentInfo.userName.split(' ');
      if (nameArray.length > 1) {
        paymentMethod = {
          firstName: nameArray[0],
          lastName: nameArray[1],
        };
      } else {
        paymentMethod = {
          firstName: nameArray[0],
          lastName: '',
        };
      }
    }
    return paymentMethod;
  },

  getBrowserFingerprint(origin?: string): BrowserFingerprint {
    return {
      origin: origin || window.location.origin,
      browserInfo: this.getBrowserDetails(),
    };
  },

  getBrowserDetailsAsJson(): Record<string, string> {
    const browserDetails = this.getBrowserDetails();
    const payload: Record<string, string> = {};
    if (browserDetails && Object.keys(browserDetails).length > 0) {
      payload.browser_details = JSON.stringify(browserDetails);
    }
    return payload;
  },

  getBrowserFingerprintHeaders(origin?: string): Promise<BrowserFingerprintHeaders> {
    const merchantOrigin = origin || window.location.origin;

    return Promise.all([
      this.hashBrowserFingerprint({
        origin: merchantOrigin,
        ...this.getBrowserInfoFingerprintData(),
      }),
      this.hashBrowserFingerprint(this.getHardwareFingerprintData()),
    ]).then(([browserFingerprint, hardwareFingerprint]) => ({
      browserFingerprint,
      hardwareFingerprint,
    }));
  },

  getBrowserInfoFingerprintData(): BrowserInfoFingerprintData {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      languages: navigator.languages,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      cookieEnabled: navigator.cookieEnabled,
    };
  },

  getHardwareFingerprintData(): HardwareFingerprintData {
    const navigatorWithMemory = navigator as Navigator & {deviceMemory?: number};

    return {
      platform: navigator.platform,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: navigatorWithMemory.deviceMemory,
      maxTouchPoints: navigator.maxTouchPoints,
      colorDepth: screen.colorDepth,
      screenWidth: screen.width,
      screenHeight: screen.height,
      pixelRatio: window.devicePixelRatio,
    };
  },

  hashBrowserFingerprint(
    fingerprint: BrowserFingerprint | BrowserInfoFingerprintData | HardwareFingerprintData | Record<string, unknown>
  ): Promise<string> {
    return this.digestSha256(JSON.stringify(fingerprint));
  },

  digestSha256(value: string): Promise<string> {
    if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
      const encoder = new TextEncoder();
      return crypto.subtle.digest('SHA-256', encoder.encode(value)).then((buffer) =>
        Array.from(new Uint8Array(buffer))
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join('')
      );
    }

    return Promise.resolve(this.fnv1aHash(value));
  },

  fnv1aHash(value: string): string {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    return (hash >>> 0).toString(16).padStart(8, '0');
  },

  getBrowserDetails(): BrowserDetails {
    return {
      colorDepth: screen.colorDepth,
      javaEnabled: navigator.javaEnabled(),
      language: navigator.language,
      screenHeight: screen.height,
      screenWidth: screen.width,
      timeZoneOffset: new Date().getTimezoneOffset(),
      userAgent: navigator.userAgent,
    };
  },
};

export default Utils;
