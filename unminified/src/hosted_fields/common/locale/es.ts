export default {
  error: {
    // Validation Errors
    validation: {
      cardNumberInvalid: 'Esta no es una tarjeta válida.',
      cardNumberIncomplete: 'El número de tarjeta es inválido.',
      invalidCard: 'Esta no es una tarjeta válida.',
      cardCommonDeclineReason: 'Lo sentimos, actualmente no aceptamos esta tarjeta.',

      cardExpiryPast: 'Esta tarjeta ha caducado.',
      cardExpiryInvalid: 'La fecha de caducidad es inválida.',
      cardExpiryIncomplete: 'La fecha de caducidad es inválida.',

      cardCvvIncomplete: 'El código de verificación de la tarjeta (CVV) es inválido.',
      cardCvvInvalid: 'El código de verificación de la tarjeta (CVV) es inválido.',
    },
  },

  placeholder: {
    number: 'Número de tarjeta',
    expiry: 'MM / AA',
    cvv: 'CVV',
    bank_select: 'Seleccionar banco',
    bank_list: 'Buscando lista de bancos admitidos',
  },

  label: {
    bank_select: 'Banco',
  },

  ariaLabel: {
    number: 'Número de tarjeta',
    expiry: 'expiración',
    cvv: 'CVV',
  },

  // Temporary solution to display error in v2 & v3 hp.
  displayError: {
    //  common errors
    common: 'Se ha producido un error al procesar su solicitud.',
    tryAgain:
      'Se ha producido un error al procesar su solicitud. Elija un método de pago distinto o inténtelo de nuevo.',
    refused: 'No se puede procesar su solicitud porque falló la verificación de 3DS.',

    // stripe errors
    amount_too_small:
      'El monto es demasiado pequeño para procesar esta transacción. Póngase en contacto con el soporte para obtener ayuda.',
    card_declined:
      'El banco emisor de su tarjeta ha rechazado este pago. Contacte con su banco para obtener asistencia.',
    expired_card: 'La tarjeta ha caducado. Utilice otra tarjeta',
    incorrect_cvc: 'La información del pago que ha indicado no es correcta.',
    incorrect_number: 'La información del pago que ha indicado no es correcta.',
    incorrect_zip: 'El código postal que ha indicado para la tarjeta no es correcto.',
    processing_error:
      'Se ha producido un error al procesar su solicitud. Elija un método de pago distinto o inténtelo de nuevo.',
    token_already_used:
      'No podemos procesar esta transacción. Póngase en contacto con el servicio de asistencia al cliente para obtener ayuda.',
  },
};
