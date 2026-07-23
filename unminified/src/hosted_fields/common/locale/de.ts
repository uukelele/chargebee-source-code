export default {
  error: {
    // Validation Errors
    validation: {
      cardNumberInvalid: 'Dies ist keine gültige Karte.',
      cardNumberIncomplete: 'Kartennummer ist ungültig.',
      invalidCard: 'Dies ist keine gültige Karte.',
      cardCommonDeclineReason: 'Entschuldigung, wir akzeptieren diese Karte derzeit nicht.',

      cardExpiryPast: 'Diese Karte ist abgelaufen.',
      cardExpiryInvalid: 'Ablaufdatum ist ungültig.',
      cardExpiryIncomplete: 'Ablaufdatum ist ungültig.',

      cardCvvIncomplete: 'Kartenprüfwert (Card verification code, CVV) ist ungültig.',
      cardCvvInvalid: 'Kartenprüfwert (Card verification code, CVV) ist ungültig.',
    },
  },

  placeholder: {
    number: 'Kartennummer',
    expiry: 'MM / JJ',
    cvv: 'CVV',
    bank_select: 'Bank auswählen',
    bank_list: 'Liste der unterstützten Banken abrufen',
  },

  label: {
    bank_select: 'Bank',
  },

  ariaLabel: {
    number: 'Kartennummer',
    expiry: 'Ablauf',
    cvv: 'CVV',
  },

  // Temporary solution to display error in v2 & v3 hp.
  displayError: {
    //  common errors
    common: 'Beim Verarbeiten Ihrer Anfrage ist ein Fehler aufgetreten.',
    tryAgain:
      'Beim Verarbeiten Ihrer Anfrage ist ein Fehler aufgetreten. Wählen Sie eine andere Zahlungsmethode oder versuchen Sie es erneut.',
    refused: 'Ihre Anfrage kann nicht verarbeitet werden, da die 3D-Secure-Verifizierung fehlgeschlagen ist.',

    // stripe errors
    amount_too_small:
      'Der Betrag ist zu gering, um diese Transaktion zu verarbeiten. Wenden Sie sich an den Support, um Hilfe zu erhalten.',
    card_declined: 'Ihre Kartenausgabebank hat diese Zahlung abgelehnt, bitte informieren Sie sich bei Ihrer Hausbank.',
    expired_card: 'Die Karte ist abgelaufen, bitte verwenden Sie eine andere Karte.',
    incorrect_cvc: 'Die von Ihnen angegebenen Zahlungsinformationen sind ungültig.',
    incorrect_number: 'Die von Ihnen angegebenen Zahlungsinformationen sind ungültig.',
    incorrect_zip: 'Die Postleitzahl, die Sie für die Karte angegeben haben, ist ungültig.',
    processing_error:
      'Beim Verarbeiten Ihrer Anfrage ist ein Fehler aufgetreten. Wählen Sie eine andere Zahlungsmethode oder versuchen Sie es erneut.',
    token_already_used:
      'Wir können diese Transaktion nicht verarbeiten. Wenden Sie sich an den Support, um Hilfe zu erhalten.',
  },
};
