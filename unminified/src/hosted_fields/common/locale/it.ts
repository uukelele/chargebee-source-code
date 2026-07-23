export default {
  error: {
    // Validation Errors
    validation: {
      cardNumberInvalid: 'Questa carta non è valida.',
      cardNumberIncomplete: 'Numero carta non valido.',
      invalidCard: 'Questa carta non è valida.',
      cardCommonDeclineReason: 'Siamo spiacenti, attualmente non accettiamo questa carta.',

      cardExpiryPast: 'La carta è scaduta.',
      cardExpiryInvalid: 'La data di scadenza non è valida.',
      cardExpiryIncomplete: 'La data di scadenza non è valida.',

      cardCvvIncomplete: 'Il codice di verifica della carta (CVV) non è valido.',
      cardCvvInvalid: 'Il codice di verifica della carta (CVV) non è valido.',
    },
  },

  placeholder: {
    number: 'Numero carta',
    expiry: 'MM / AA',
    cvv: 'CVV',
    bank_select: 'Selezionare la banca',
    bank_list: 'Recupero della lista delle banche supportate',
  },

  label: {
    bank_select: 'Banca',
  },

  ariaLabel: {
    number: 'Numero carta',
    expiry: 'scadenza',
    cvv: 'CVV',
  },

  // Temporary solution to display error in v2 & v3 hp.
  displayError: {
    //  common errors
    common: 'Si è verificato un errore durante l’elaborazione della richiesta.',
    tryAgain:
      'Si è verificato un errore durante l’elaborazione della richiesta. Scegli un altro metodo di pagamento oppure riprova.',
    refused: 'Non è possibile elaborare la richiesta perché la verifica 3DS non è andata a buon fine.',

    // stripe errors
    amount_too_small:
      'L’importo è troppo piccolo per elaborare questa transazione. Contatta l’assistenza per assistenza.',
    card_declined:
      'L’istituto di emissione della carta ha rifiutato il pagamento. Contatta la banca per ricevere assistenza.',
    expired_card: 'La carta è scaduta; si prega di utilizzare un’altra carta',
    incorrect_cvc: 'I dati di pagamento forniti non sono validi.',
    incorrect_number: 'I dati di pagamento forniti non sono validi.',
    incorrect_zip: 'Il codice di avviamento postale indicato per la carta non è valido.',
    processing_error:
      'Si è verificato un errore durante l’elaborazione della richiesta. Scegli un altro metodo di pagamento oppure riprova.',
    token_already_used:
      'Non è possibile completare la transazione. Contatta il supporto tecnico per ricevere assistenza.',
  },
};
