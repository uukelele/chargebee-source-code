import {HOST_NAME} from '@/hosted_fields/common/connection/client';
import Helpers from '@/helpers';

// HTML String to HTML Element
export function strToHTML(htmlString: string): HTMLElement | SVGElement | null {
  if (typeof htmlString === 'string') {
    try {
      let wrapper = document.createElement('div');
      wrapper.innerHTML = htmlString.trim();
      return <HTMLElement>wrapper.firstChild;
    } catch (e) {
      // Handle error
    }
  }
  return null;
}

// Generic utility function to combine multiple nested objects
export function deepAssign(target: object, ...sources) {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, {[key]: {}});
        deepAssign(target[key], source[key]);
      } else {
        Object.assign(target, {[key]: source[key]});
      }
    }
  }

  return deepAssign(target, ...sources);
}

export function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

// Get values of object/enum
export function getValuesOf(data) {
  return Object.keys(data).map((key) => data[key]);
}

// Deep clone objects
function deepClone(obj) {
  let clone = {};
  for (let i in obj) {
    if (obj[i] != null && typeof obj[i] == 'object') clone[i] = deepClone(obj[i]);
    else clone[i] = obj[i];
  }
  return clone;
}

export const clone = (data: any) => {
  if (data) {
    if (data.constructor === Object) return deepClone(data);
    if (data.constructor === Array)
      return data.map((el) => (typeof el !== 'undefined' ? JSON.parse(JSON.stringify(el)) : undefined));
  }
  return data;
};

export function toggleClass(el: HTMLElement, className: string, cond: boolean) {
  if (el && className) {
    let cssClass = el.getAttribute('class') || '';
    const isClassPresent = has(cssClass, className);

    if (cond && !isClassPresent) {
      // If cond=true & class not present -> Add css class
      cssClass = `${cssClass} ${className}`;
    } else if (!cond && isClassPresent) {
      // If cond=false & class is already present -> Remove css class
      cssClass = cssClass.replace(className, '');
    }

    el.setAttribute('class', cssClass);

    // el.classList.toggle(className, cond)
  }
}

export type Iterator = (value: any, index: number, obj: any[]) => boolean;

export function find(arr: Array<any>, iterator: Iterator): any {
  if (arr.constructor === Array && typeof iterator === 'function') {
    let index = arr.findIndex(iterator);
    if (!!~index) return arr[index];
  }
  return undefined;
}

export function safeText(text: string): string {
  if (typeof text === 'string') {
    let doc = new DOMParser().parseFromString(text, 'text/html');
    return doc.body.textContent || '';
  }
  return text;
}

export function removeQuotes(str: string): string {
  if (typeof str !== 'string') return '';
  return safeText(str.replace(/['"]+/g, ''));
}

export function normalizeWhitelist(list: string[] = []): string[] {
  const out = new Set<string>();
  for (let raw of list) {
    if (!raw) continue;
    let s = String(raw)
      .trim()
      .replace(/^['"]|['"]$/g, ''); // drop surrounding quotes
    try {
      // Parse with scheme if missing so URL() works for bare hosts
      const u = new URL(/^https?:\/\//i.test(s) ? s : `http://${s}`);
      out.add(u.hostname.toLowerCase());
    } catch (error) {
      // Fallback: take up to first slash, lower-case
      out.add(s.split('/')[0].toLowerCase());
    }
  }
  return [...out];
}

// Get contents within (brackets)
export function getContentWithinBrackets(str: string): string {
  if (typeof str !== 'string') return '';
  // Returns only first match
  let matches = str.match(/\(([^)]+)\)/);
  if (matches) {
    let match = matches[1];
    // remove quotes if any
    return removeQuotes(match);
  }
  return '';
}

export function has(parent: any, child: any): boolean {
  if (parent && (typeof parent === 'string' || parent.constructor === Array)) return !!~parent.indexOf(child);
  return false;
}

// Noop function
export function noop() {}

// Equality comparison for objects
export const isEqual = (left, right): boolean => {
  const PLAIN_OBJECT_STR = '[object Object]';

  if (typeof left !== 'object' || typeof right !== 'object') {
    return left === right;
  }

  if (left === null || right === null) return left === right;

  const leftArray = Array.isArray(left);
  const rightArray = Array.isArray(right);

  if (leftArray !== rightArray) return false;

  const leftPlainObject = Object.prototype.toString.call(left) === PLAIN_OBJECT_STR;
  const rightPlainObject = Object.prototype.toString.call(right) === PLAIN_OBJECT_STR;

  if (leftPlainObject !== rightPlainObject) return false;

  if (!leftPlainObject && !leftArray) return false;

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) return false;

  const keySet = {};
  for (let i = 0; i < leftKeys.length; i += 1) {
    keySet[leftKeys[i]] = true;
  }
  for (let i = 0; i < rightKeys.length; i += 1) {
    keySet[rightKeys[i]] = true;
  }
  const allKeys = Object.keys(keySet);
  if (allKeys.length !== leftKeys.length) {
    return false;
  }

  const l = left;
  const r = right;
  const pred = (key) => {
    return isEqual(l[key], r[key]);
  };

  return allKeys.every(pred);
};

export function combineObjectArray(data: Array<object>): object {
  return data.reduce((parent: object, child: object) => {
    return {
      ...parent,
      ...child,
    };
  }, {});
}

export function isElement(element: HTMLElement): boolean {
  // @ts-ignore
  if (element instanceof HTMLElement) {
    return true;
  }
  return (
    element !== null &&
    typeof element === 'object' &&
    // @ts-ignore
    element.nodeType === 1 &&
    // @ts-ignore
    typeof element.style === 'object' &&
    // @ts-ignore
    typeof element.ownerDocument === 'object'
  );
}

export function setFrameLoaded(frame) {
  // Communicate frame loaded to HOST
  window.parent.postMessage(
    {
      cbEvent: true,
      targetWindowName: HOST_NAME,
      srcWindowName: window.name,
      message: {
        action: 'setFrameLoaded',
        data: {frame},
      },
    },
    '*'
  );
}

export function generateHtmlElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  styles?: Partial<CSSStyleDeclaration>
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  if (styles) {
    Object.keys(styles).forEach((prop) => {
      element.style[prop] = styles[prop];
    });
  }
  return element;
}

export function getElementById(target: string | HTMLElement): HTMLElement | undefined {
  let container: HTMLElement = null;
  if (typeof target === 'string') {
    container = document.querySelector(target);
  } else if (isElement(target)) {
    container = target;
    target.id = target.id || Helpers.genUuid();
  }
  return container;
}

export function getComputedProperty(el: HTMLElement, propertyName: string): string | undefined {
  if (!el || !propertyName) return;
  let value;
  try {
    // Type: CSSUnitValue
    const computedProperty = (el as any).computedStyleMap && (el as any).computedStyleMap().get(propertyName);
    // @ts-ignore
    value = computedProperty && `${computedProperty.value}${computedProperty.unit}`;
  } catch (e) {
    // ignore error
  }
  value = value || el.style[propertyName];
  return value;
}
