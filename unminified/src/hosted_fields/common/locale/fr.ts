export default {
  error: {
    // Validation Errors
    validation: {
      cardNumberInvalid: 'Cette carte n’est pas valide.',
      cardNumberIncomplete: 'Le numéro de carte n’est pas valide.',
      invalidCard: 'Cette carte n’est pas valide.',
      cardCommonDeclineReason: "Désolé, nous n'acceptons pas cette carte pour le moment.",

      cardExpiryPast: 'Cette carte a expiré.',
      cardExpiryInvalid: 'La date d’expiration n’est pas valide.',
      cardExpiryIncomplete: 'La date d’expiration n’est pas valide.',

      cardCvvIncomplete: 'Le code de vérification de la carte (CVV) n’est pas valide.',
      cardCvvInvalid: 'Le code de vérification de la carte (CVV) n’est pas valide.',
    },
  },

  placeholder: {
    number: 'Numéro de carte',
    expiry: 'MM / AA',
    cvv: 'CVV',
    bank_select: 'Choisir une banque',
    bank_list: 'Liste des banques prises en charge',
  },

  label: {
    bank_select: 'Banque',
  },

  ariaLabel: {
    number: 'Numéro de carte',
    expiry: 'expiration',
    cvv: 'CVV',
  },

  // Temporary solution to display error in v2 & v3 hp.
  displayError: {
    //  common errors
    common: 'Une erreur s’est produite lors du traitement de votre demande.',
    tryAgain:
      'Une erreur s’est produite lors du traitement de votre demande. Choisissez un mode de paiement différent ou réessayez.',
    refused: 'Impossible de traiter votre demande car la vérification 3D Secure a échoué.',

    // stripe errors
    amount_too_small:
      'Le montant est trop petit pour traiter cette transaction. Contactez l’assistance pour obtenir de l’aide.',
    card_declined: 'Votre paiement par carte a été refusé : veuillez contacter votre banque.',
    expired_card: 'Cette carte a expiré : veuillez utiliser une autre carte',
    incorrect_cvc: 'Vos informations de paiement sont erronées.',
    incorrect_number: 'Vos informations de paiement sont erronées.',
    incorrect_zip: 'Le code postal que vous avez saisi pour cette carte est erroné.',
    processing_error:
      'Une erreur s’est produite lors du traitement de votre demande. Choisissez un mode de paiement différent ou réessayez.',
    token_already_used: 'Nous ne pouvons pas traiter cette opération. Veuillez contacter l’assistance.',
  },
};
