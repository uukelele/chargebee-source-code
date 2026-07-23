import {U} from './utils';
import {OS} from './constants';
import {OSInfo} from './types';

function mapWindowsNTVersion(nt: string): string {
  const versionMap: Record<string, string> = {
    '10.0': '10',
    '6.3': '8.1',
    '6.2': '8',
    '6.1': '7',
    '6.0': 'vista',
    '5.1': 'xp',
  };

  return versionMap[nt] || nt || '';
}

function detectWindowsOS(ua: string): OSInfo | null {
  if (!/windows nt/i.test(ua)) {
    return null;
  }

  const nt = U.getFirstMatch(/Windows NT ([0-9.]+)/i, ua);
  const mapped = mapWindowsNTVersion(nt);
  return {name: OS.WINDOWS, version: mapped};
}

function detectWindowsPhone(ua: string): OSInfo | null {
  if (!/windows phone/i.test(ua)) {
    return null;
  }

  return {
    name: OS.WINDOWS_PHONE,
    version: U.getFirstMatch(/Windows Phone (?:OS )?([0-9._]+)/i, ua),
  };
}

function detectChromeOS(ua: string): OSInfo | null {
  if (!/cros/i.test(ua)) {
    return null;
  }

  return {
    name: OS.CHROME_OS,
    version: U.getFirstMatch(/CrOS [^ ]+ ([0-9.]+)/i, ua),
  };
}

function detectIOS(ua: string): OSInfo | null {
  if (!/(iphone|ipad|ipod)/i.test(ua)) {
    return null;
  }

  const v = U.getFirstMatch(/OS ([0-9_\.]+)/i, ua).replace(/_/g, '.');
  return {name: OS.IOS, version: v};
}

function detectMacOS(ua: string): OSInfo | null {
  if (!/mac os x/i.test(ua)) {
    return null;
  }

  const major = U.getFirstMatch(/Mac OS X (10|11|12|13|14|15)/i, ua);
  const minor = U.getSecondMatch(/Mac OS X (10|11|12|13|14|15)[._](\d+)/i, ua);
  const patch = U.getSecondMatch(/Mac OS X (?:10|11|12|13|14|15)[._]\d+[._](\d+)/i, ua);
  const version = U.joinVersionParts([major, minor, patch]).replace(/_/g, '.');
  return {name: OS.MACOS, version: version};
}

function detectAndroid(ua: string): OSInfo | null {
  if (!/android/i.test(ua)) {
    return null;
  }

  return {
    name: OS.ANDROID,
    version: U.getFirstMatch(/Android ([0-9.]+)/i, ua),
  };
}

function detectLinux(ua: string): OSInfo | null {
  if (!/linux|x11/i.test(ua)) {
    return null;
  }

  return {name: OS.LINUX, version: ''};
}

export function detectOS(ua: string): OSInfo {
  const detectors = [
    detectWindowsPhone,
    detectWindowsOS,
    detectChromeOS,
    detectIOS,
    detectMacOS,
    detectAndroid,
    detectLinux,
  ];

  for (const detector of detectors) {
    const result = detector(ua);
    if (result) {
      return result;
    }
  }

  return {name: OS.UNKNOWN, version: ''};
}
