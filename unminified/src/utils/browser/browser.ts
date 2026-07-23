import {U} from './utils';
import {BROWSERS} from './constants';
import {BrowserInfo} from './types';

export function detectBrowser(ua: string): BrowserInfo {
  const l = U.toLower(ua);

  // iOS-specific tokens (different from desktop tokens)
  if (/fxios\/\d+/i.test(ua)) return {name: BROWSERS.FIREFOX, version: U.getFirstMatch(/FxiOS\/([0-9.]+)/i, ua)};
  if (/crios\/\d+/i.test(ua)) return {name: BROWSERS.CHROME, version: U.getFirstMatch(/CriOS\/([0-9.]+)/i, ua)};
  if (/edgios\/\d+/i.test(ua)) return {name: BROWSERS.EDGE, version: U.getFirstMatch(/EdgiOS\/([0-9.]+)/i, ua)};
  if (/opriOS\/\d+/i.test(ua)) return {name: BROWSERS.OPERA, version: U.getFirstMatch(/OPRiOS\/([0-9.]+)/i, ua)};

  // IE (legacy or IE11/Trident)
  if (U.matchAndReturnConst(/msie\s|trident\/.+rv:/i, l, true)) {
    const v = U.getFirstMatch(/MSIE\s([0-9.]+)/i, ua) || U.getFirstMatch(/rv:([0-9.]+)/i, ua);
    return {name: BROWSERS.IE, version: v};
  }

  // Edge (Chromium) then Legacy Edge
  if (U.matchAndReturnConst(/edg\//i, l, true)) {
    return {name: BROWSERS.EDGE, version: U.getFirstMatch(/Edg\/([0-9.]+)/i, ua)};
  }
  if (U.matchAndReturnConst(/edge\//i, l, true)) {
    return {name: BROWSERS.EDGE_LEGACY, version: U.getFirstMatch(/Edge\/([0-9.]+)/i, ua)};
  }

  // Opera before Chrome
  if (U.matchAndReturnConst(/opr\//i, l, true) || U.matchAndReturnConst(/opera\//i, l, true)) {
    const ov = U.getFirstMatch(/OPR\/([0-9.]+)/i, ua) || U.getFirstMatch(/Opera\/([0-9.]+)/i, ua);
    return {name: BROWSERS.OPERA, version: ov};
  }

  // Firefox before Chrome (no real overlap, but conventional)
  if (U.matchAndReturnConst(/firefox\//i, l, true)) {
    return {name: BROWSERS.FIREFOX, version: U.getFirstMatch(/Firefox\/([0-9.]+)/i, ua)};
  }

  // Safari must exclude Chromium family
  if (U.matchAndReturnConst(/safari/i, l, true) && !/chrome|crios|edg|opr|opera/i.test(l)) {
    const sv = U.getFirstMatch(/Version\/([0-9.]+)/i, ua) || U.getFirstMatch(/Safari\/([0-9.]+)/i, ua);
    return {name: BROWSERS.SAFARI, version: sv};
  }

  // Chrome last among Chromium family
  if (U.matchAndReturnConst(/chrome\//i, l, true)) {
    return {name: BROWSERS.CHROME, version: U.getFirstMatch(/Chrome\/([0-9.]+)/i, ua)};
  }

  return {name: BROWSERS.UNKNOWN, version: ''};
}

export default detectBrowser;
