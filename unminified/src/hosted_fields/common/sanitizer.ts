import Errors, {Warn, CbError} from '@/hosted_fields/common/errors';
import {HostedFields, Entity, Card, Currency} from '@/hosted_fields/common/enums';
import {
  ComponentOptions,
  StyleBlock,
  Styles,
  Classes,
  FontFace,
  Locale,
  Placeholder,
  AriaLabel,
  Fields,
} from '@/hosted_fields/common/types';
import {
  getValuesOf,
  removeQuotes,
  getContentWithinBrackets,
  has,
  safeText,
  noop,
  clone,
  normalizeWhitelist,
} from '@/hosted_fields/common/dom-utils';
import {SupportedLocales, DefaultLocale} from '@/hosted_fields/common/locale';
import '@/helpers/polyfills';
import Logger from '@/utils/logger_old';
import {isValidLocale} from '@/utils/utility-functions';
import FieldOption = HostedFields.FieldOption;

const {Options, CSSClass, StyleSections, FontProperty, StdCSSProperty, CustomCSSProperty, PseudoCSSProperty} =
  HostedFields;

export function addStyle(name: string, value: string): string {
  return value && typeof value === 'string' && !!value.trim().length
    ? `${name}: ${Sanitizer.htmlSafeText(value)};`
    : '';
}

export interface Options {
  [HostedFields.Options.style]?: Styles;
  [HostedFields.Options.placeholder]?: Placeholder | string;
  [HostedFields.Options.ariaLabel]?: AriaLabel | string;
}

function getOptionsByEntityType(entityType: Entity): string[] {
  if (entityType === Entity.component) {
    return Object.keys(Options);
  } else if (entityType === Entity.field) {
    return [Options.placeholder, Options.ariaLabel, Options.style, Options.icon];
  }
  return [];
}

// Validate and Sanitize input options
export function sanitizeInput<T extends Options>(inputOptions: T, entityType: Entity): T {
  let options: T = clone(inputOptions);
  const optionNames = getOptionsByEntityType(entityType);
  optionNames.map((opt) => {
    if (Sanitizer[opt]) {
      Sanitizer[opt](options[opt], options, entityType);
    } else {
      if (entityType === Entity.component) Warn(Errors.unknownProperty, {property: opt, componentType: ''});
      else if (entityType === Entity.field) Warn(Errors.unknownFieldProperty, {property: opt});
      delete options[opt];
    }
  });
  return options;
}

// Util to warn if its an unknown field property
function isUnknownFieldProp(prop: string, parent: object, type: Entity): boolean {
  if (type !== Entity.component) {
    Warn(Errors.unknownFieldProperty, {property: prop});
    delete parent[prop];
    return true;
  }
  return false;
}

// Util to warn invalid css
function onInvalidCssValue(prop: string, parent: object): void {
  Warn(Errors.invalidCssValue, {property: prop});
  delete parent[prop];
}

function sanitizeStyles(styles: StyleBlock) {
  if (!styles || styles.constructor !== Object) {
    Warn(Errors.invalidStyles);
    return;
  }
  const allowed: Array<string> = [
    ...getValuesOf(StdCSSProperty),
    ...getValuesOf(CustomCSSProperty),
    ...getValuesOf(PseudoCSSProperty),
    ...getValuesOf(FontProperty),
  ];
  Object.keys(styles).map((prop) => {
    if (!has(allowed, prop)) {
      Warn(Errors.unknownCssProperty, {property: prop});
      // Mutation
      delete styles[prop];
      return;
    }
    if (typeof styles[prop] !== 'string' && typeof styles[prop] !== 'number') return sanitizeStyles(styles[prop]);

    // Sanitize by corresponding style
    if (Sanitizer[prop]) {
      styles[prop] = Sanitizer.htmlSafeText(styles[prop]);
      Sanitizer[prop](prop, styles[prop], styles);
    } else {
      const err = new CbError({
        name: 'NoSanitizerDefined',
        message: `No sanitizer for ${prop}`,
      });
      Logger.sendLog(err);
    }
  });
}

const Sanitizer = {
  // Style Sanitizations -----------------
  [StdCSSProperty.color]: (prop: string, value: string, parent: StyleBlock) => {
    let re =
      /(^[a-zA-Z]+$)|(#(?:[0-9a-f]{2}){2,4}|#[0-9a-f]{3}|(?:rgba?)\((?:\d+%?(?:deg|rad|grad|turn)?(?:,|\s)+){2,3}[\s\/]*[\d\.]+%?\))/i;
    if (!re.test(value)) {
      Warn(Errors.invalidCssColor, {color: value});
      delete parent[prop];
    }
  },
  [StdCSSProperty.webkitTextColor]: (prop: string, value: string, parent: StyleBlock) => {
    let re =
      /(^[a-zA-Z]+$)|(#(?:[0-9a-f]{2}){2,4}|#[0-9a-f]{3}|(?:rgba?)\((?:\d+%?(?:deg|rad|grad|turn)?(?:,|\s)+){2,3}[\s\/]*[\d\.]+%?\))/i;
    if (!re.test(value)) {
      Warn(Errors.invalidCssColor, {webkitTextColor: value});
      delete parent[prop];
    }
  },
  [CustomCSSProperty.iconColor]: (prop: string, value: string, parent: StyleBlock) => {
    Sanitizer[StdCSSProperty.color](prop, value, parent);
  },
  [FontProperty.fontSize]: (prop: string, value: string, parent: StyleBlock) => {
    if (!has(value, 'px') && !has(value, 'em')) {
      onInvalidCssValue(prop, parent);
    } else if (!has(value, 'px')) Warn(Errors.fontNotInPx);
  },
  [FontProperty.fontFamily]: noop,
  [FontProperty.fontSmoothing]: (prop: string, value: string, parent: StyleBlock) => {
    const _allowed = ['subpixel-antialiased', 'antialiased', 'auto', 'none'];
    if (!has(_allowed, value)) {
      onInvalidCssValue(prop, parent);
    }
  },
  [FontProperty.fontStyle]: (prop: string, value: string, parent: StyleBlock) => {
    const _allowed = ['normal', 'italic', 'oblique'];
    if (!has(_allowed, value)) {
      onInvalidCssValue(prop, parent);
    }
  },
  [FontProperty.fontVariant]: (prop: string, value: string, parent: StyleBlock) => {
    const _allowed = [
      'normal',
      'small-caps',
      'none',
      'common-ligatures',
      'no-common-ligatures',
      'discretionary-ligatures',
      'no-discretionary-ligatures',
      'historical-ligatures',
      'no-historical-ligatures',
      'contextual',
      'no-contextual',
      'all-small-caps',
      'petite-caps',
      'all-petite-caps',
      'unicase',
      'titling-caps',
      'lining-nums',
      'oldstyle-nums',
      'proportional-nums',
      'tabular-nums',
      'diagonal-fractions',
      'stacked-fractions',
      'ordinal',
      'slashed-zero',
      'jis78',
      'jis83',
      'jis90',
      'jis04',
      'simplified',
      'traditional',
      'full-width',
      'proportional-width',
      'ruby',
    ];
    let _values = value.split(' ');
    _values.every((v) => {
      if (!has(_allowed, v)) {
        onInvalidCssValue(prop, parent);
        return false;
      }
      return true;
    });
  },
  [FontProperty.fontWeight]: (prop: string, value: string, parent: StyleBlock) => {
    const _allowed = ['normal', 'bold', 'lighter', 'bolder'];
    if (!has(_allowed, value) && isNaN(parseInt(value))) {
      onInvalidCssValue(prop, parent);
    }
  },
  [StdCSSProperty.letterSpacing]: (prop: string, value: string, parent: StyleBlock) => {
    const _allowed = ['normal'];
    if (!has(_allowed, value)) {
      if (value.endsWith('px') || value.endsWith('em')) {
        let n = value.replace('px', '').replace('em', '');
        if (isNaN(parseInt(n))) {
          onInvalidCssValue(prop, parent);
        }
      } else {
        onInvalidCssValue(prop, parent);
      }
    }
  },
  [StdCSSProperty.textAlign]: (prop: string, value: string, parent: StyleBlock) => {
    const _allowed = ['start', 'end', 'left', 'right', 'center', 'justify', 'justify-all', 'match-parent'];
    if (!has(_allowed, value)) {
      onInvalidCssValue(prop, parent);
    }
  },
  [StdCSSProperty.textDecoration]: noop,
  [StdCSSProperty.textShadow]: noop,
  [StdCSSProperty.textTransform]: (prop: string, value: string, parent: StyleBlock) => {
    const _allowed = ['none', 'capitalize', 'uppercase', 'lowercase', 'full-width', 'full-size-kana'];
    if (!has(_allowed, value)) {
      onInvalidCssValue(prop, parent);
    }
  },
  [StdCSSProperty.lineHeight]: (prop: string, value: string, parent: StyleBlock) => {
    const _allowed = ['normal', 'initial', 'inherit'];
    if (!has(_allowed, value)) {
      if (value.endsWith('px') || value.endsWith('%') || value.endsWith('em')) {
        let n = value.replace('px', '').replace('%', '').replace('em', '');
        if (isNaN(parseInt(n))) {
          onInvalidCssValue(prop, parent);
        }
      } else {
        onInvalidCssValue(prop, parent);
      }
    }
  },

  // Options sanitizations ---------------------
  [Options.icon](icon: boolean, parent: ComponentOptions) {
    if (typeof icon !== 'boolean') {
      if (!icon) {
        parent[Options.icon] = true;
        return;
      }
      Warn(Errors.invalidValueProvided, {
        property: Options.icon,
        value: JSON.stringify(icon),
      });
      delete parent[Options.icon];
      return;
    }
  },
  [Options.currency](currencyKey: Currency, parent: ComponentOptions, type: Entity) {
    if (!currencyKey) return;
    // !TODO Check Supported currencies
    if (isUnknownFieldProp(Options.currency, parent, type)) return;
  },
  [Options.classes](classes: Classes, parent: ComponentOptions, type: Entity) {
    if (!classes) return;
    if (isUnknownFieldProp(Options.classes, parent, type)) return;

    const allowed = getValuesOf(CSSClass);
    Object.keys(classes).map((_class) => {
      if (has(allowed, _class)) {
        let classValue = classes[_class];
        if (typeof classValue !== 'string') {
          Warn(Errors.incorrectClass, {value: classValue, classname: _class});
          // Mutation
          delete classes[_class];
        }
      } else {
        Warn(Errors.unknownCssClass, {classname: _class});
        delete classes[_class];
      }
    });
  },
  [Options.style](styles: Styles) {
    if (!styles) return;
    const allowed = getValuesOf(StyleSections);
    Object.keys(styles).map((prop) => {
      if (!has(allowed, prop)) {
        Warn(Errors.unknownStyleProperty, {property: prop});
        // Mutation
        delete styles[prop];
        return;
      }
      // Sanitize style object
      sanitizeStyles(styles[prop]);
    });
  },
  [Options.fonts](fonts: Array<FontFace>, parent: ComponentOptions, type: Entity, whitelist: Array<string> = []) {
    if (!fonts) return;
    if (isUnknownFieldProp(Options.fonts, parent, type)) return;

    fonts.map((font, index) => {
      if (font && font.constructor === Object) {
        const allowed = getValuesOf(FontProperty);

        Object.keys(font).map((fontProp: HostedFields.FontProperty) => {
          if (!has(allowed, fontProp)) {
            Warn(Errors.unknownFontProp, {property: fontProp});
            delete font[fontProp];
          }
        });

        if (font.src) {
          // Mutation
          font.src = Sanitizer.fontSrc(font.src, whitelist);
        }
      } else if (typeof font === 'string') {
        let sanitizedURL: string = Sanitizer.fontURL(font, whitelist);
        if (!sanitizedURL) delete parent[Options.fonts][index];
        //@ts-ignore
        else parent[Options.fonts][index] = sanitizedURL;
      } else {
        Warn(Errors.invalidFont, {font: JSON.stringify(font)});
        // Mutation
        delete parent[Options.fonts][index];
      }
    });
  },
  [Options.field](field: Fields, parent: ComponentOptions, type: Entity) {
    if (!field) {
      parent[Options.field] = {};
      Object.keys(HostedFields.Field).forEach((item) => {
        parent[Options.field][item] = {};
        Object.keys(FieldOption).forEach((fieldOption: FieldOption) => {
          parent[Options.field][item][fieldOption] = true;
        });
      });
    }

    if (isUnknownFieldProp(Options.field, parent, type)) {
      return;
    }
    const allowed = getValuesOf(HostedFields.Field);
    Object.keys(parent[Options.field]).forEach((field: HostedFields.Field) => {
      if (has(allowed, field)) {
        Object.keys(FieldOption).forEach((fieldOption: FieldOption) => {
          const value = parent[Options.field][field][fieldOption];
          if (typeof value !== 'boolean') {
            Warn(Errors.invalidValueProvided, {
              property: Options.field,
              value: JSON.stringify(value),
            });
            delete parent[Options.field][field][fieldOption];
          }
        });
      } else {
        Warn(Errors.invalidFields, {field});
        // Mutation
        delete parent[Options.placeholder][field];
      }
    });
  },
  [Options.locale](locale: Locale, parent: ComponentOptions, type: Entity) {
    if (!locale) return;
    if (!has(SupportedLocales, locale) && !isValidLocale(locale)) {
      Warn(Errors.localeNotSupported, {locale});
      // Reverting to default locale
      // Mutation
      parent[Options.locale] = DefaultLocale;
    }
  },
  [Options.placeholder](placeholder: Placeholder, parent: ComponentOptions, type: Entity) {
    if (!placeholder) return;
    if (placeholder.constructor === Object) {
      const allowed = getValuesOf(Card.ComponentFieldType);
      Object.keys(placeholder).map((field: Card.ComponentFieldType) => {
        if (!has(allowed, field)) {
          Warn(Errors.invalidPlaceholderValue, {field});
          // Mutation
          delete parent[Options.placeholder][field];
        }
      });
    } else if (typeof placeholder === 'string' && type == Entity.field) {
      // Placeholder string passed to a field
      return;
    } else {
      Warn(Errors.invalidPlaceholder);
      delete parent[HostedFields.Options.placeholder];
    }
  },
  [Options.ariaLabel](ariaLabel: AriaLabel, parent: ComponentOptions, type: Entity) {
    if (!ariaLabel) return;
    if (ariaLabel.constructor === Object) {
      const allowed = getValuesOf(HostedFields.AriaLabel);
      Object.keys(ariaLabel).map((_ariaLabel) => {
        if (has(allowed, _ariaLabel)) {
          let ariaLabelValue = ariaLabel[_ariaLabel];
          if (typeof ariaLabelValue !== 'string' || ariaLabelValue.length > 200) {
            Warn(Errors.invalidAriaLabel, {ariaLabelValue});
            // Mutation
            delete parent[Options.ariaLabel][_ariaLabel];
          } else {
            parent[Options.ariaLabel][_ariaLabel] = removeQuotes(ariaLabelValue);
          }
        } else {
          Warn(Errors.invalidAriaLabel);
          delete parent[HostedFields.Options.ariaLabel][_ariaLabel];
        }
      });
    } else if (typeof ariaLabel === 'string' && type == Entity.field) {
      // ariaLabel passed to a field
      let _ariaLabel: string = ariaLabel;
      if (_ariaLabel.length > 200) {
        Warn(Errors.invalidAriaLabel, {_ariaLabel});
        delete parent[HostedFields.Options.ariaLabel];
      }
    } else {
      Warn(Errors.invalidAriaLabel);
      delete parent[HostedFields.Options.ariaLabel];
    }
  },

  // General Sanitizers ---------------------
  // HTML Safe text sanitizer
  htmlSafeText: (text: string): string => {
    return safeText(text);
  },

  // Font URL Sanitizer
  fontURL: (url: string, whitelist = []): string => {
    url = removeQuotes(url);

    let whitelistDomains = ['fonts.googleapis.com', 'use.typekit.net', ...normalizeWhitelist(whitelist)];
    try {
      let _url = new URL(url);
      if (!has(whitelistDomains, _url.host)) {
        Warn(Errors.fontUrlNotWhitelisted, {url: _url.host});
        return '';
      }
    } catch (e) {
      Warn(Errors.invalidSrcUrl, {url});
      return '';
    }
    return url;
  },

  fontSrcContents: (key: string, value: string, whitelist: Array<string>) => {
    switch (key) {
      case 'local':
        value = encodeURIComponent(Sanitizer.htmlSafeText(value));
        break;
      case 'url':
        value = Sanitizer.fontURL(value, whitelist);
        if (!value.trim()) return '';
        break;
      case 'format': {
        let allowed = ['svg', 'woff', 'opentype'];
        if (!has(allowed, removeQuotes(value))) return '';
        break;
      }
      default:
        return '';
    }
    return `${key}(${value.trim()})`;
  },

  // Font src sanitizer
  fontSrc: (src: string, whitelist: string[]): string => {
    return src
      .split(',')
      .map((substr: string) => {
        substr = substr.trim();
        if (has(substr, 'local')) {
          return Sanitizer.fontSrcContents('local', getContentWithinBrackets(substr), whitelist);
        } else if (has(substr, 'url') && has(substr, 'format')) {
          let splitStr: string[] = substr.split(' ');
          let processedStr: string[] = splitStr.map((s) => Sanitizer.fontSrc(s, whitelist));
          if (!processedStr.every((s) => !!s)) return '';
          return processedStr.join(' ');
        } else if (has(substr, 'url')) {
          return Sanitizer.fontSrcContents('url', getContentWithinBrackets(substr), whitelist);
        } else if (has(substr, 'format')) {
          return Sanitizer.fontSrcContents('format', getContentWithinBrackets(substr), whitelist);
        }
        return '';
      })
      .filter((s) => s)
      .join(', ');
  },
};

export default Sanitizer;
