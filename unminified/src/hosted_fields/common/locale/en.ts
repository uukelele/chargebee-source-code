export default {
  error: {
    unknownError: 'Sorry! Something went wrong',
    recaptchaMaxRetryOver: 'Unable to load captcha (Code:GRE1)',
    captchaGenerateTokenMaxRetryOver: 'Unable to load captcha (Code:CEGTRF)',
    captchaInitializationMaxRetryOver: 'Unable to load captcha (Code:CEINRF)',
    recaptchaLoadTimeout: 'Unable to load captcha (Code:CELTOF)',
    recaptchaScriptLoadFailed: 'Unable to load captcha (Code:CESLF)',
    recaptchaInitiationTimeout: 'Unable to initiate reCAPTCHA verification. Try again (Code:CEGTF)',
    scriptError: 'Error loading gateway script',

    // Validation Errors
    validation: {
      cardNumberInvalid: 'Invalid card',
      cardNumberIncomplete: 'Invalid card',
      invalidCard: 'Invalid card',
      cardCommonDeclineReason: "Sorry, we currently don't accept this card",

      cardExpiryPast: 'Expired card',
      cardExpiryInvalid: 'Invalid expiration date.',
      cardExpiryIncomplete: 'Invalid expiration date.',

      cardCvvIncomplete: 'Invalid card verification code (CVC).',
      cardCvvInvalid: 'Invalid card verification code (CVC).',
    },
    // Component Errors
    component: {
      moduleNotSupported: '${module} module not supported',
      moduleNotLoaded: 'Components module not loaded',
      invalidComponentType: '%{componentType} is an invalid component type.',
      invalidSelector: '%{selector} selector is invalid.',
      invalidListener: '%{listener} is an invalid listener.',
      validationFailed: 'Validation failed',
      noContainerElement: 'Container element not specified for %{field} %{entity}',
      containerElementNotFound: 'Container element not found',

      // Internal errors
      frameNotSpecified: 'Child frame not specified',
      componentNotRegistered: 'Component/Frame is not yet registered',
      componentNotFound: 'Component not found',
    },

    // Host errors
    host: {
      missingMandatoryParameters: 'Missing mandatory %{parameters} on %{target}',
    },

    // Field errors
    field: {
      invalidFieldType: '%{fieldType} is an invalid field type for %{componentType} component.',
      fieldAlreadyExists: '%{fieldType} field already exists.',
      fieldNotAllowed: '%{fieldType} field is not allowed for %{componentType} component.',
      noFieldsToMount: 'No fields to mount',
      missingFields: 'Some fields are missing for %{componentType} component.',
    },

    // Master Errors
    master: {
      replyTimeout: 'Action timed out for %{action}',

      // Internal errors
      componentAlreadyPresent: 'Component already present',
      errorMountingMaster: 'Could not mount master component',
      instanceAlreadyExists: 'Master instance already exists',
      unknownMessageOrigin: 'Message from unknown domain',
      sendMessageError: 'Child can send messages only to its parent',
      sendMessageMismatchError: 'Child can send messages only to its parent - domain mismatch',
      noMessageTarget: 'No message target specified',
      receiveMessageError: 'Child can receive messages only from its parent',
      responseError: 'Child can only respond to its parent',
      responseMismatchError: 'Child can only respond to its parent - domain mismatch',
      masterNotMountedForComponents: 'Master not mounted for components',
    },

    options: {
      missingPublishableKey: 'Missing publishable key',
    },

    threedsecure: {
      invalidPaymentIntent: 'Invalid Payment Intent',
      missingCardDetails: 'Missing mandatory card fields number, expiryMonth, expiryYear',
      invalidCardReferenceId: 'Invalid card reference ID',
      unknownPaymentAttemptStatus: 'Unknown payment attempt status',
      // Adyen
      adyen: {
        invalidAdyenCheckoutInstance: 'Invalid adyen checkout instance',
        missingPaymentInfo:
          'Missing payment information for handling card payment. Either one of Adyen card instance or Client Side Encrypted card token or card details should be present',
        missingRedirectInfo: 'Redirection details are missing for processing 3DS 1.0 Verification',
        invalidOriginKey: 'Invalid origin key provided for creating Adyen Checkout',
      },

      // Braintree
      braintree: {
        missingPaymentInfo:
          'Missing payment information for handling card payment. Either one of Braintree hosted fields instance or tokenization function or card details should be present',
        invalidInstance: 'Invalid Braintree instance',
        missingInstance: 'Missing Braintree instance',
        missingThreeDSecure: 'Braintree 3D Secure library is missing',
        failedThreeDSecureAuth: '3DS Authentication Failed',
        invalidHostedFields: 'Invalid Braintree hosted fields instance',
        invalidTokenizedCard: 'Invalid tokenized card details passed',
        noTokenizedCards: 'No valid tokenized cards available for payment processing',
        missingNonceForBraintreeReferenceId: 'Missing payment method nonce for card reference ID',
      },

      // Spreedly
      spreedly: {
        missingPaymentInfo: 'Missing payment information for handling card payment',
      },

      // Stripe
      stripe: {
        invalidInstance: 'Invalid stripe instance',
        missingPaymentInfo:
          'Missing payment information for handling card payment. Either one of Stripe elements instance or tokenization function or card details should be present',
        missingInstance: 'Missing stripe instance',
      },

      bluesnap: {
        missingPaymentInfo:
          'Missing payment information for handling card payment. Either card details or card reference ID should be present',
      },

      ingenico_direct: {
        missingPaymentInfo: 'Missing payment information for handling card payment',
      },

      worldpay: {
        missingPaymentInfo: 'Missing payment information for handling card payment',
        missingCardHolderInfo: 'Missing card holder information, Either firstName or lastName should be present',
        missingEmailInfo: 'Missing email information, email should be present',
      },

      mollie: {
        missingPaymentInfo: 'Missing payment information for handling card payment',
        missingCardHolderInfo: 'Missing card holder information, Either firstName or lastName should be present',
      },

      razorpay: {
        missingPaymentInfo: 'Missing payment information for handling card payment',
        missingCardHolderInfo: 'Missing card holder information, Either firstName or lastName should be present',
        missingEmailInfo: 'Missing email information, email should be present',
        missingPhoneInfo: 'Missing Phone information, phone number should be present',
      },

      bankOfAmerica: {
        missingEmailInfo: 'Missing email information, email should be present',
        missingPaymentInfo: 'Missing payment information for handling card payment',
      },

      payfurl: {
        missingPaymentInfo: 'Missing payment information for handling card payment',
        missingCountryCode: 'Missing country code to validate Document ID',
      },

      paycom: {
        missingPaymentInfo: 'Missing payment information for handling card payment',
        invalidOrMissingPaymentInfo: 'The given payment information is invalid or missing some mandatory parameters',
      },

      // EBANX
      ebanx: {
        missingPaymentInfo: 'Missing payment information for handling card payment',
        invalidDocument: 'Invalid Document',
      },
      // DLOCAL
      dlocal: {
        missingPaymentInfo: 'Missing payment information for handling card payment',
        invalidDocument: 'Document number is either missing or invalid.',
      },

      // CHARGEBEE PAYMENTS
      chargebeePayments: {
        missingPaymentInfo: 'Missing payment information for handling card payment',
        invalidChargebeePaymentsCheckoutInstance: 'Invalid chargebee payments checkout instance',
      },

      // VANTIV PAYMENTS
      vantivPayments: {
        missingPaymentInfo: 'Missing payment information for handling card payment.',
      },

      // GLOBAL PAYMENTS
      globalPayments: {
        missingPaymentInfo:
          'Missing payment information for handling card payment. Either card details or card reference ID should be present',
      },
    },

    payments: {
      common: {
        missingPaymentIntentForMountButton:
          'Missing payment intent. Payment intent is required to mount payment button',
      },
      iDeal: {
        missingCurrency: 'Missing currency to fetch bank list',
        adyen: {
          missingIssuerBank:
            'Missing issuer bank. Either choose a bank from the dropdown or pass it through payment info',
        },
      },

      bancontant: {
        adyen: {
          missingPaymentInfo:
            'Missing payment information for handling bancontact payment. Either one of Adyen card instance or card details should be present',
        },
      },
      klarnaPayNow: {
        adyen: {
          missingBillingAddressInfo: 'Invalid Billing address info : first name and last name are mandatory',
        },
      },

      gpay: {
        missingTokenInfoInPaymentData: 'Missing token information for handling google payment',
      },
      applepay: {
        applePayNotSupported: `Sorry, We're unable to mount the payment button here`,
        applePayPaymentsNotAvailable: 'This device is not capable of making Apple Pay payments',
        applePayElementNotFound: `Apple Pay button element not found `,
      },
      directDebit: {
        unsupportedScheme: `Sorry, We're not yet supported this scheme for direct debit`,
        unsupportedGateway: `Sorry, We're not yet supported this gateway for direct debit`,
        missingPaymentInfo: 'Missing payment information for handling direct debit payment',
        invalidOrMissingPaymentInfo: 'The given payment information is invalid or missing some mandatory parameters',
        plaidNotsupported: 'Plaid is not connected on your gateway account',
      },
      boleto: {
        missingPaymentInfo: 'Missing payment information for handling boleto payment',
        invalidOrMissingPaymentInfo: 'The given payment information is invalid or missing some mandatory parameters',
      },
      venmo: {
        venmoNotSupportedByBrowser: 'Browser does not support Venmo',
        venmoAppCanceled: 'User canceled payment flow',
        venmoCanceled: 'App is not available or user aborted payment flow',
      },
      fasterPayment: {
        invalidOrMissingPaymentInfo: 'The given payment information is invalid or missing some mandatory parameters',
        missingCountryCode: 'Missing country code to fetch bank list',
        eitherCurrencyCodeOrGwAccIdRequired: 'Either currency code or Gateway Account Id should be passed',
      },
      payTo: {
        invalidOrMissingPaymentInfo: 'The given payment information is invalid or missing some mandatory parameters',
        missingCountryCode: 'Missing country code to fetch bank list',
        eitherCurrencyCodeOrGwAccIdRequired: 'Either currency code or Gateway Account Id should be passed',
      },
      sepaInstantTransfer: {
        invalidOrMissingPaymentInfo: 'The given payment information is invalid or missing some mandatory parameters',
        missingCountryCode: 'Missing country code to fetch bank list',
        eitherCurrencyCodeOrGwAccIdRequired: 'Either currency code or Gateway Account Id should be passed',
      },
    },

    functions: {
      vat: {
        missingVatParams: 'Missing mandatory parameters for VAT Validation - country, vat_number',
      },
    },

    components: {
      invalidComponent: 'Invalid component',
    },
  },
  warning: {
    // Component
    component: {
      componentNotMounted: 'Component is not yet mounted.',
      componentMounting: 'Cannot call %{name} as this %{componentType} component is mounting.',
      componentAlreadyMounted: '%{componentType} is already mounted.',
      componentNotRegistered: '%{componentType} component is not yet registered',
    },

    //CSS Sanitization
    css: {
      unknownProperty: '%{property} is not a valid property for this %{componentType} component.',
      invalidValue: '%{value} is invalid for %{property} property.',
      unknownFieldProperty: '%{property} is not a valid property for field.',
      unknownCssProperty: '%{property} is not a supported CSS property.',
      unknownCssClass: '%{classname} is not a valid classname.',
      incorrectClass: '%{value} is not a valid for ${classname} classname.',
      unknownFontProp: '%{property} is not a supported font property.',
      invalidFont: '%{font} is not a valid font type.',
      invalidSrcUrl: '%{url} is an invalid URL for this src field.',
      fontUrlNotWhitelisted: '%{url} is not a whitelisted font URL.',

      // Style errors
      fontNotInPx: 'Font size must be specified in pixels.',
      invalidCssValue: 'Invalid CSS property value specified for %{property}.',
      invalidCssColor: '%{color} is an invalid CSS colour.',
    },

    // Component/Field Options sanitization
    options: {
      localeNotSupported: '%{locale} locale is not supported.',
      invalidPlaceholderObject: 'Invalid placeholder specified',
      invalidFields: 'Invalid fields specified',
      invalidPlaceholderValue: '%{field} has an invalid placeholder.',
      unknownStyleProperty: '%{property} is not a supported style.',
      invalidStyles: 'Invalid styles specified',
    },
  },

  // Temporary solution to display error in v2 & v3 hp.
  displayError: {
    //  common errors
    common: 'An error occurred while processing your request.',
    tryAgain: 'An error occurred while processing your request. Choose a different payment method or try again.',
    refused: 'Unable to process your request as 3DS verification failed.',

    // stripe errors
    amount_too_small: 'Amount is too small to process this transaction. Contact support for help.',
    card_declined: 'Your card issuer bank has declined this payment.Please contact your bank for support.',
    expired_card: 'The card has expired.Please use another card.',
    incorrect_cvc: 'Payment information you’ve specified is invalid.',
    incorrect_number: 'Payment information you’ve specified is invalid.',
    incorrect_zip: 'Zip code you’ve specified for the card is invalid.',
    processing_error:
      'An error occurred while processing your request. Choose a different payment method or try again.',
    token_already_used: 'We’re unable to process this transaction. Contact support for help.',
    invalid_or_missing_payment_info: 'The given payment information is invalid or missing some mandatory parameters',
    // braintree error
    // CLIENT_REQUEST_ERROR
  },

  placeholder: {
    number: 'Card Number',
    expiry: 'MM / YY',
    cvv: 'CVV',
    bank_select: 'Select Bank',
    bank_list: 'Fetching list of supported banks',
  },

  label: {
    bank_select: 'Bank',
  },

  ariaLabel: {
    number: 'Card Number',
    expiry: 'Expiry',
    cvv: 'CVV',
  },
};
