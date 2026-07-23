export default {
  error: {
    // Validation Errors
    validation: {
      cardNumberInvalid: 'Este não é um cartão válido.',
      cardNumberIncomplete: 'O número do cartão é inválido.',
      invalidCard: 'Este não é um cartão válido.',
      cardCommonDeclineReason: 'Desculpe, atualmente não aceitamos este cartão.',

      cardExpiryPast: 'Este cartão expirou.',
      cardExpiryInvalid: 'A data de expiração é inválida.',
      cardExpiryIncomplete: 'A data de expiração é inválida.',

      cardCvvIncomplete: 'O código de verificação do cartão (CVV) é inválido.',
      cardCvvInvalid: 'O código de verificação do cartão (CVV) é inválido.',
    },
  },

  placeholder: {
    number: 'Número do cartão',
    expiry: 'MM / AA',
    cvv: 'CVV',
    bank_select: 'Selecionar Banco',
    bank_list: 'Obtenção da lista de bancos suportados',
  },

  label: {
    bank_select: 'Banco',
  },

  ariaLabel: {
    number: 'Número do cartão',
    expiry: 'termo',
    cvv: 'CVV',
  },

  // Temporary solution to display error in v2 & v3 hp.
  displayError: {
    //  common errors
    common: 'Ocorreu um erro ao processar o seu pedido.',
    tryAgain: 'Ocorreu um erro ao processar o seu pedido. Escolha um método de pagamento diferente ou tente novamente.',
    refused: 'Não foi possível processar o seu pedido devido à falha da verificação 3DS.',

    // stripe errors
    amount_too_small:
      'O valor é muito pequeno para processar esta transação. Entre em contato com o suporte para obter ajuda.',
    card_declined: 'O banco emissor do seu cartão recusou este pagamento. Contacte o seu banco para obter assistência.',
    expired_card: 'O cartão expirou. Utilize outro cartão',
    incorrect_cvc: 'As informações de pagamento inseridas são inválidas.',
    incorrect_number: 'As informações de pagamento inseridas são inválidas.',
    incorrect_zip: 'O código postal inserido para o cartão é inválido.',
    processing_error:
      'Ocorreu um erro ao processar o seu pedido. Escolha um método de pagamento diferente ou tente novamente.',
    token_already_used: 'Não nos foi possível processar esta transação. Contacte o apoio ao cliente para obter ajuda.',
  },
};
