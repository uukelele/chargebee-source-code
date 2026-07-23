export const BROWSERS = {
  CHROME: 'chrome',
  FIREFOX: 'firefox',
  SAFARI: 'safari',
  EDGE: 'edge',
  EDGE_LEGACY: 'edge_legacy',
  OPERA: 'opera',
  IE: 'ie',
  UNKNOWN: 'unknown',
} as const;

export const DEVICES = {
  DESKTOP: 'desktop',
  MOBILE: 'mobile',
  TABLET: 'tablet',
} as const;

export const OS = {
  WINDOWS: 'windows',
  WINDOWS_PHONE: 'windows_phone',
  MACOS: 'macos',
  IOS: 'ios',
  ANDROID: 'android',
  LINUX: 'linux',
  CHROME_OS: 'chrome_os',
  UNKNOWN: 'unknown',
} as const;
