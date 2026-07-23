import {CbError} from '@/hosted_fields/common/errors';
import {StateFullPromise} from '@/hosted_fields/common/types';
import {wrapWithStates} from '@/internal/common/utils';
import {jsonify} from './utility-functions';
import {debugMode} from '@/constants/environment';

export enum RetryStrategy {
  /* 
    Execute Once:
      Executes one attempt and returns the promise once its resolved
      When failure occurs, the next attempt is made till retry limit is reached
      When the same method is called again, if the method was already resolved, it simply returns the previously resolved promise instead of executing once again
  */
  ExecuteOnce,
  /* 
    Execute All attempts:
      Executes the method and returns the promise once its resolved
      When failure occurs, the next attempt is made till retry limit is reached
      When the same method is called again, the method gets executed each time.
  */
  ExecuteAllAttempts,
}
export type RetryErrorData = {
  cb_action_name?: string;
  cb_retry_attempt?: number;
  cb_retry_error?: any;
};

export type RetryOptions = {
  errors: {
    maxAttemptsReached: string;
    executionTimeout: string;
  };
  strategy?: RetryStrategy;
  actionName?: string;
  onError?: (errorData: RetryErrorData) => void;
};

export default class RetryMechanism<T> {
  public MAX_RETRIES = 5;
  public EXEC_TIMEOUT = 10000;
  private preparedPromise: StateFullPromise<any> = null;
  public options: RetryOptions;
  public callable: () => Promise<any>;

  constructor(callable: () => Promise<T>, options: RetryOptions) {
    this.callable = callable;
    this.options = options;
  }

  public setMaxRetries(retries: number) {
    this.MAX_RETRIES = retries;
    return this;
  }

  public setExecutionTimeout(timeout: number) {
    this.EXEC_TIMEOUT = timeout;
    return this;
  }

  private triggerErrorCallback(attempt: number, error: any) {
    try {
      const onErrorCallback = this.options.onError;
      if (onErrorCallback && typeof onErrorCallback === 'function') {
        const payload: RetryErrorData = {
          cb_retry_attempt: attempt,
          cb_retry_error: jsonify(error),
        };
        if (this.options.actionName && typeof this.options.actionName === 'string') {
          payload.cb_action_name = this.options.actionName;
        }
        onErrorCallback(payload);
      }
    } catch (e) {
      if (debugMode()) console.error(e);
    }
  }

  public execute(): Promise<T> {
    if (this.options.strategy === RetryStrategy.ExecuteOnce) {
      if (this.preparedPromise) {
        if (this.preparedPromise.isRejected()) {
          return Promise.reject(new CbError(this.options.errors.maxAttemptsReached));
        } else {
          return this.preparedPromise;
        }
      }
    }

    this.preparedPromise = wrapWithStates(
      new Promise((resolve, reject) => {
        let retryCounter = 0;
        let timer;

        const onFailure = (error?: any) => {
          if (++retryCounter > this.MAX_RETRIES) {
            clearTimeout(timer);
            const err = new CbError(error || this.options.errors.maxAttemptsReached);
            this.triggerErrorCallback(retryCounter - 1, err);
            return reject(err);
          } else {
            this.triggerErrorCallback(retryCounter - 1, error);
            caller();
          }
        };

        const onSuccess = (token) => {
          clearTimeout(timer);
          resolve(token);
        };

        const startTimer = () => {
          clearTimeout(timer);
          timer = setTimeout(() => onFailure(this.options.errors.executionTimeout), this.EXEC_TIMEOUT);
        };

        const caller = async () => {
          try {
            startTimer();
            const result = await this.callable();
            onSuccess(result);
          } catch (e) {
            onFailure(e);
          }
        };

        caller();
      })
    );
    return this.preparedPromise;
  }
}
