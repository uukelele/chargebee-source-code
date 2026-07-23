import {U} from './utils';
import {DEVICES} from './constants';
import {DeviceType} from './types';

export function detectDeviceType(ua: string): DeviceType {
  const l = U.toLower(ua);

  if (/(ipad|tablet)/.test(l)) {
    return DEVICES.TABLET;
  }

  if (/(mobi|iphone|ipod|android)/.test(l)) {
    return DEVICES.MOBILE;
  }

  return DEVICES.DESKTOP;
}
