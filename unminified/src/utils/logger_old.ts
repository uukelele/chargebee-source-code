import '@/helpers/polyfills';
import * as Sentry from '@sentry/browser';
import t from '@/hosted_fields/common/locale';
import LogKeys from '@/constants/log-keys';
import ApiClient from '@/hosted_fields/master/api-client';
import Ids from '@/constants/ids';
import Helpers from '@/helpers';
import {flattenObj, jsonify} from '@/utils/utility-functions';
import {CbError} from '@/hosted_fields/common/errors';

type ErrorCounterData = {
  [key: string]: number;
};

class ErrorCounter {
  static ERROR_COUNTER_DATA_KEY = 'cb_js_error_log';
  static LOG_THRESHOLD_LIMIT = 10;

  static readErrorLog(): ErrorCounterData {
    if (sessionStorage) {
      let errorLog: any = sessionStorage.getItem(ErrorCounter.ERROR_COUNTER_DATA_KEY);
      if (errorLog) {
        errorLog = JSON.parse(errorLog) as ErrorCounterData;
        return errorLog;
      }
    }
    return {};
  }

  static writeErrorLog(log: ErrorCounterData) {
    if (sessionStorage && log) {
      sessionStorage.setItem(ErrorCounter.ERROR_COUNTER_DATA_KEY, JSON.stringify(log));
    }
  }

  static getKey(err: any): string | undefined {
    if (err && err.message) return JSON.stringify(err.message);
  }

  static trackErrorCount(err: any) {
    try {
      const key = ErrorCounter.getKey(err);
      const errorLog = ErrorCounter.readErrorLog();
      if (key && sessionStorage) {
        let counter: any = errorLog[key];
        if (!counter) errorLog[key] = 1;
        else errorLog[key] += 1;
      }
      ErrorCounter.writeErrorLog(errorLog);
    } catch (e) {
      // console.error(e)
    }
  }

  static thresholdExceeded(err: any): boolean {
    let exceeded = false;
    try {
      const key = ErrorCounter.getKey(err);
      if (key && sessionStorage) {
        const errorLog = ErrorCounter.readErrorLog();
        let counter: any = errorLog[key];
        if (counter) {
          exceeded = counter > ErrorCounter.LOG_THRESHOLD_LIMIT;
        }
      }
      return exceeded;
    } catch (e) {
      // console.error(e)
      return exceeded;
    }
  }
}

export default class Logger {
  static apiClient: ApiClient;
  static init(apiClient?) {
    try {
      Sentry.init({
        sampleRate: 0.2,
        // @ts-ignore
        dsn: __SENTRY_DSN__,
        // @ts-ignore
        release: __RELEASE__,
        // @ts-ignore
        environment: __ENVIRONMENT__,
      });
    } catch (e) {
      // Sentry polyfill issue
    }

    if (apiClient) Logger.apiClient = apiClient;
  }

  static setScope({domain, hostName, site, ...others}) {
    try {
      Sentry.configureScope((scope) => {
        if (domain) {
          scope.setTag('domain', domain);
          scope.setTag('site', site);
          scope.setExtra('domain', domain);
        }
        if (hostName) scope.setExtra('hostName', hostName);
        Object.keys(others).map((key) => {
          scope.setExtra(key, others[key]);
        });
      });
    } catch (e) {
      // Sentry polyfill issue
    }
  }

  static sanitizeError(err): Error {
    if (err instanceof Error || (err && err.name)) {
      if (err.displayMessage) {
        const error = new Error(err.message);
        error.name = err.name;
        return error;
      }
      return err;
    }
    return new Error(err);
  }

  static error(error, extraData?) {
    const err = new CbError(error);
    if (err) {
      if (extraData) {
        try {
          // Creating a local sentry scope
          Sentry.withScope((scope) => {
            if (extraData && extraData.site) {
              scope.setTag('domain', extraData.site);
            }
            scope.setExtras(extraData);

            ErrorCounter.trackErrorCount(err);
            if (!ErrorCounter.thresholdExceeded(err)) {
              Sentry.captureException(err);
            }
          });
        } catch (e) {
          // Sentry polyfill issue
        }
      } else {
        try {
          Sentry.captureException(err);
        } catch (e) {
          // Sentry polyfill issue
        }
      }
    }

    return err;
  }

  static throw(err, extraData?) {
    throw Logger.error(err, extraData);
  }

  static getMaskedError(err, extraData?): Error {
    Logger.error(err, extraData);

    // Create a masked error
    let maskedError = new Error();
    maskedError.name = 'error.unknownError';
    maskedError.message = t('error.unknownError');

    return maskedError;
  }

  static throwMaskedError(err, extraData?) {
    throw Logger.getMaskedError(err, extraData);
  }

  static info(message: string, extraData?) {
    if (extraData && extraData.constructor === Object) {
      try {
        // Creating a local sentry scope
        Sentry.withScope((scope) => {
          scope.setExtras(extraData);
          Sentry.captureMessage(message);
        });
      } catch (e) {
        // Sentry polyfill issue
      }
    } else {
      try {
        Sentry.captureMessage(message);
      } catch (e) {
        // sentry polyfill issue
      }
    }
  }

  static toJSON(err) {
    let jsonErr: any = {};
    if (!err) return jsonErr;

    if (err.constructor === Object) return err;
    return jsonify(err);
  }

  static async kvl(data: any, extraData: any = {}) {
    const payload = flattenObj({
      ...Logger.toJSON(data),
      ...extraData,
      key: LogKeys.LOGGING,
      _module: 'chargebee.js',
    });
    const _data = {
      data: payload,
      type: 'kvl',
    };
    if (Logger.apiClient) {
      try {
        const loggerFn =
          // @ts-ignore
          Logger.apiClient.logger.info_error || Logger.apiClient.logger.track;
        await loggerFn({}, _data);
      } catch (e) {
        // Error while kvl with chargebee-app
        Logger.error(e);
      }
    }
  }

  static sendLog(info, extraData = {}) {
    const payload = flattenObj({
      ...Logger.toJSON(info),
      ...extraData,
    });
    let data = {
      ...payload,
      type: 'kvl',
      key: LogKeys.LOGGING,
      _module: 'chargebee.js',
    };

    try {
      let cbFrame = <HTMLIFrameElement>document.getElementById(Ids.UTILITY_FRAME);

      // If iframe already loaded
      if (cbFrame.dataset.loaded === 'true') {
        cbFrame.contentWindow.postMessage(data, Helpers.getDomain());
      } else {
        const MAX_TIMEOUT = 10000;
        let elapsed = 0;
        const interval = 100;

        // Check for iframe load at set intervals
        let checkIframeLoad = setInterval(function () {
          if (cbFrame.dataset.loaded === 'true') {
            cbFrame.contentWindow.postMessage(data, Helpers.getDomain());
            clearInterval(checkIframeLoad);
            return;
          }

          elapsed += interval;
          // if Iframe unable to load
          if (elapsed > MAX_TIMEOUT) {
            const err = new Error('Iframe connector not loaded');
            Logger.error(err);
            clearInterval(checkIframeLoad);
          }
        }, interval);
      }
    } catch (error) {
      // console.error(data);
      // console.error(error);
    }
  }
}
