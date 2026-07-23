import en from '@/hosted_fields/common/locale/en';
import fr from '@/hosted_fields/common/locale/fr';
import es from '@/hosted_fields/common/locale/es';
import pt from '@/hosted_fields/common/locale/pt';
import it from '@/hosted_fields/common/locale/it';
import de from '@/hosted_fields/common/locale/de';
import {Card, Locale as L, IDeal} from '@/hosted_fields/common/enums';
import {Translations} from './types';
import {isValidLocale} from '@/utils/utility-functions';
declare var Intl: {
  getCanonicalLocales(langCode: string): Array<String>;
};

export const Locale = {en, fr, es, pt, it, de};
export const DefaultLocale: L = L.en;
const LanguageMap = {
  [L.en]: 'en-GB',
  [L.fr]: 'fr-FR',
  [L.de]: 'de-DE',
  [L.it]: 'it-IT',
  [L.pt]: 'pt-PT',
  [L.es]: 'es-ES',
};
export const SupportedLocales = [...Object.keys(Locale), ...Object.keys(LanguageMap).map((key) => LanguageMap[key])];

const TextPrefix = 'cbjs_grp';
const LocaleText = {};

// Replace placeholder
export function templateString(str: string, data: object | string): string {
  let result = '';
  if (typeof str !== 'string') return result;
  result = str;
  if (data) {
    if (typeof data === 'string') data = {value: JSON.stringify(data)};
    if (typeof data == 'object') {
      Object.keys(data).map((key) => {
        let tmpl = `%{${key}}`;
        if (!!~str.indexOf(tmpl)) {
          result = result.replace(new RegExp(tmpl, 'g'), data[key]);
        }
      });
    }
  }
  return result;
}

export function getLanguageCode(code: L = DefaultLocale): string {
  if (Intl && Intl.getCanonicalLocales) {
    try {
      const locales = Intl.getCanonicalLocales(code);
      code = <L>locales[0];
    } catch (e) {}
  }
  return LanguageMap[code] || isValidLocale(code) ? code : LanguageMap[DefaultLocale];
}

export function sanitizeLocale(locale: L): L {
  if (locale) locale = <L>locale.split('-')[0];
  return locale;
}

// Text loaded from backend
export function getLocaleText(key: string, locale: L = DefaultLocale): string {
  if (!key) return '';
  locale = sanitizeLocale(locale);
  let text = LocaleText[locale] && LocaleText[locale][`${TextPrefix}.${key}`];
  if (!text) text = LocaleText[DefaultLocale] && LocaleText[DefaultLocale][`${TextPrefix}.${key}`];
  return text;
}

export function getAllTranslations(): Translations {
  return LocaleText;
}

export function setLocaleText(translations: Translations) {
  Object.assign(LocaleText, translations);
}

// Locale selection
const getLocaleTexts = (locale: L) => {
  try {
    return Locale[locale] || Locale['' + locale.toLowerCase()] || Locale[DefaultLocale];
  } catch (e) {
    //
  }
  return Locale[DefaultLocale];
};

// Traverse and fetch an object's property
const getProperty = (path: string, parentObject: object): string =>
  path.split('.').reduce((obj, prop) => obj[prop], parentObject);

const getText = (path: string, locale: L): string => {
  let message = '';
  if (path) {
    try {
      const text = getLocaleTexts(locale);
      message = getProperty(path, text);
    } catch (e) {
      // Unable to find key
    }
    if (!message) message = getProperty(path, Locale[DefaultLocale]);
  } else {
    // TODO - Sentry track - stack trace
    message = getText('error.unknownError', DefaultLocale);
  }
  return message;
};

/**
 * t - Text translator
 * @param code - Text code
 * @param data - Data for template substitution
 * @param locale - locale for text message
 */
export const t = (code: string, data?: object, locale?: L): string => {
  let message: string = getText(code, locale);
  return templateString(message, data);
};

export const TextCodes = {
  placeholder: {
    [Card.ComponentFieldType.Number]: 'placeholder.number',
    [Card.ComponentFieldType.Expiry]: 'placeholder.expiry',
    [Card.ComponentFieldType.CVV]: 'placeholder.cvv',
    [IDeal.ComponentFieldType.BankSelect]: 'placeholder.bank_select',
    [IDeal.ComponentFieldType.BankList]: 'placeholder.bank_list',
  },
  label: {
    [IDeal.ComponentFieldType.BankSelect]: 'label.bank_select',
  },
  ariaLabel: {
    [Card.ComponentFieldType.Number]: 'ariaLabel.number',
    [Card.ComponentFieldType.Expiry]: 'ariaLabel.expiry',
    [Card.ComponentFieldType.CVV]: 'ariaLabel.cvv',
  },
};

export default t;
