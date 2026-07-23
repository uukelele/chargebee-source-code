import ErrorCodes, {CbError} from '@/hosted_fields/common/errors';
import t from '@/hosted_fields/common/locale';
import {jsonify} from '@/utils/utility-functions';

const EC_TRY_AGAIN = 'displayError.tryAgain';
const EC_REFUSED = 'displayError.refused';
const EC_COMMON = 'displayError.common';

function getDisplayMessage(error, locale?): string {
  if (typeof error.name == 'string' && error.name.startsWith('PAYMENT_ATTEMPT_')) {
    if (error.code) {
      switch (error.code) {
        case 'amount_too_small':
        case 'card_declined':
        case 'expired_card':
        case 'incorrect_cvc':
        case 'incorrect_number':
        case 'incorrect_zip':
        case 'processing_error':
        case 'token_already_used':
          return t(`displayError.${error.code}`, null, locale);
      }
    }
    return ''; // t(EC_REFUSED, null, locale); - To display refusal reason
  } else if (typeof error.code == 'string' && error.name === 'INVALID_OR_MISSING_PAYMENT_INFO') {
    return t('displayError.invalid_or_missing_payment_info', null, locale);
  } else if (
    typeof error.code == 'string' &&
    (error.code.startsWith('error.master') || error.code.startsWith('error.threedsecure'))
  ) {
    return t(EC_TRY_AGAIN, null, locale);
  } else {
    return t(EC_COMMON, null, locale);
  }
}

export default function sanitizeError(error, locale?) {
  if (error instanceof SanitizedCbError) {
    return error;
  } else if (error instanceof CbError) {
    let sanError = <SanitizedCbError>error;
    sanError.displayMessage = getDisplayMessage(error, locale);
    return sanError;
  } else if (typeof error === 'string') {
    return {
      message: error,
      displayMessage: error,
    };
  } else {
    error['displayMessage'] = getDisplayMessage(error, locale);
    return error;
  }
}

export class SanitizedCbError extends CbError {
  displayMessage: string;

  constructor(err?: any, data?: any, locale?, ...args) {
    super(err, data, locale, args);
    this.displayMessage = getDisplayMessage(this, locale);
  }

  toJSON(): Object {
    let json = jsonify(this);
    json['displayMessage'] = this.displayMessage;
    return json;
  }

  toString(): string {
    return `class Extended CbError ${JSON.stringify(this.toJSON(), null, 2)}`;
  }
}
