import {GatewayConfig} from '../Common/types';
import {ConfirmApiInputPayload, PaymentInfo, CardInfo} from '@/extensions/three_domain_secure/common/types';
import {loadBluesnap, createPfToken, loadDeviceDataCheck, getBluesnap} from '@/utils/payments/bluesnap';
import {CbError} from '@/hosted_fields/common/errors';
import {PaymentIntent} from '@/internal/payment-intent/types';
import {Bluesnap} from '@/extensions/three_domain_secure/handlers/bluesnap/types';
import {getCurrencyDivisor} from '@/utils/utility-functions';

/**
 * Get Bluesnap card info
 */
function getBluesnapCardInfo(
  paymentIntent: PaymentIntent,
  paymentInfo: any,
  existingCreditCard?: any
): Bluesnap.SubmitCardInfo {
  const currencyDivisor = getCurrencyDivisor(paymentIntent.currency_code);
  let card: Bluesnap.SubmitCardInfo = {
    amount: parseFloat((paymentIntent.amount / currencyDivisor).toFixed(2)),
    currency: paymentIntent.currency_code,
  };

  if (paymentInfo.card) {
    card.ccNumber = paymentInfo.card.number;
    card.cvv = paymentInfo.card.cvv;
    card.expDate = `${paymentInfo.card.expiryMonth}/${paymentInfo.card.expiryYear}`;
  }

  if (existingCreditCard) {
    card.last4Digits = existingCreditCard.cardLastFourDigits;
    card.ccType = existingCreditCard.cardType;
  }

  if (paymentInfo.customer) {
    if (paymentInfo.customer.email) card.email = paymentInfo.customer.email;
    if (paymentInfo.customer.phone) card.phone = paymentInfo.customer.phone;
  }

  if (paymentInfo.billingAddress) {
    if (paymentInfo.billingAddress.firstName) card.billingFirstName = paymentInfo.billingAddress.firstName;
    if (paymentInfo.billingAddress.lastName) card.billingLastName = paymentInfo.billingAddress.lastName;
  }

  return card;
}

/**
 * Bluesnap Gateway Configuration
 * This config is used by the UnifiedGatewaySDKHandler to handle Bluesnap 3DS payments
 */
export const BluesnapGatewayConfig: GatewayConfig = {
  /**
   * Load the Bluesnap SDK script
   */
  loadSDKScript: async (): Promise<void> => {
    await loadBluesnap();
  },

  /**
   * Create a Bluesnap SDK instance
   * For Bluesnap, we don't need to create a specific instance
   * The SDK is loaded globally
   */
  createSDKInstance: async (): Promise<any> => {
    return Promise.resolve(window['bluesnap']);
  },

  /**
   * Get the confirm API payload for Bluesnap
   * This will be used by UnifiedGatewaySDKHandler's getConfirmPayload method
   */
  getConfirmApiPayload: async (
    paymentInfo: PaymentInfo,
    paymentIntent: PaymentIntent
  ): Promise<ConfirmApiInputPayload> => {
    try {
      // Create payment form token
      const vaultId = paymentInfo.additionalData && paymentInfo.additionalData.vaultId;
      const pfTokenResponse = await createPfToken(paymentIntent, vaultId);
      const pfToken = pfTokenResponse.pfToken;
      const existingCreditCard = pfTokenResponse.creditCard;

      // Load device data check
      let sessionId;
      try {
        sessionId = await loadDeviceDataCheck(paymentInfo);
      } catch (error) {
        console.error('Failed to load device data check', error);
      }

      // Get card info for Bluesnap
      const cardInfo = getBluesnapCardInfo(paymentIntent, paymentInfo, existingCreditCard);

      // Return the payment data that will be used by UnifiedGatewaySDKHandler's getConfirmPayload
      const payload: ConfirmApiInputPayload = {};

      if (paymentInfo.card) {
        payload.paymentMethod = paymentInfo.card;
      } else if (paymentInfo.cbToken) {
        payload.cbToken = paymentInfo.cbToken;
      }

      // Add additional data if available
      if (paymentInfo.additionalData) {
        const additionalData = paymentInfo.additionalData;
        if (additionalData.email) {
          payload.email = additionalData.email;
        }
        if (additionalData.phone) {
          payload.customer = {
            phone: additionalData.phone,
          };
        }
        if (additionalData.billingAddress) {
          payload.cardBillingAddress = additionalData.billingAddress;
        }
      }

      // Call threeDsPaymentsSetup to set up the 3DS flow
      const bluesnap = getBluesnap();
      if (bluesnap && bluesnap.threeDsPaymentsSetup) {
        return new Promise((resolve, reject) => {
          bluesnap.threeDsPaymentsSetup(pfToken, (resp) => {
            if (resp.code == 1) {
              if (resp.threeDSecure) {
                payload.additionalInfo = {
                  //@ts-ignore
                  threeDsecureReferenceId: resp.threeDSecure.threeDSecureReferenceId,
                };
              }
              resolve(payload);
            } else {
              let message = '';
              if (resp.info.errors && resp.info.errors[0]) {
                message = resp.info.errors[0];
              } else if (resp.info.warnings && resp.info.warnings[0]) {
                message = resp.info.warnings[0];
              }
              reject(
                new CbError(
                  {
                    name: resp.code || 'BLUESNAP_ERROR',
                    type: 'gateway_error',
                    message: message || 'An error occurred with Bluesnap payment processing',
                  },
                  resp
                )
              );
            }
          });

          // Submit card data to Bluesnap
          if (bluesnap.threeDsPaymentsSubmitData) {
            bluesnap.threeDsPaymentsSubmitData(cardInfo);
          }
        });
      }

      return payload;
    } catch (error) {
      throw new CbError(
        {
          name: error.code || 'BLUESNAP_ERROR',
          type: 'gateway_error',
          message: error.message || 'An error occurred with Bluesnap payment processing',
        },
        error
      );
    }
  },
};
