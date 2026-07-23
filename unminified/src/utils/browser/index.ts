import {detectBrowser} from './browser';
import {detectOS} from './os';
import {detectDeviceType} from './device';
import {DetectResult} from './types';

export function detect(overrideUA?: string): DetectResult {
  let ua: string;

  if (overrideUA) {
    ua = overrideUA;
  } else if (typeof navigator !== 'undefined') {
    ua = navigator.userAgent;
  } else {
    ua = '';
  }

  const browser = detectBrowser(ua);
  const os = detectOS(ua);
  const deviceType = detectDeviceType(ua);

  return {browser, os, deviceType, ua};
}

export default {detect};
