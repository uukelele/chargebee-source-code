import {PaymentRedirectTimeouts} from '@/constants/enums';
import {NetbankingPayment} from '@/hosted_fields/common/base-types';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {Callbacks, PaymentMethodType, Gateway} from '@/internal/payment-intent/types';
import {PaymentInfo} from '../types';
import {CbError} from '@/hosted_fields/common/errors';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import Ids from '@/constants/ids';
import {Master as M} from '@/hosted_fields/common/enums';
import CbWindowManager from '@/models/cb-window-manager';
import {PAYMENT_AUTH_REDIRECT_WINDOW_NAME} from '@/hosted_fields/common/base-types';
import {fetchPaymentIntentStatus} from '@/utils/payments/razorpay';

export default class NetbankingHandler extends PaymentIntentHandler implements NetbankingPayment {
  protected declare paymentInfo: PaymentInfo;
  redirectTimeout: number = PaymentRedirectTimeouts.NETBANKING_EMANDATES;

  constructor(...args) {
    super(...args);
  }

  fetchBankList(options: any) {
    return new Promise((resolve, reject) => {
      if (!(options || options.currency)) {
        return reject(new CbError());
      }
      return this.fetchGatewayDetails(options).then((res) => {
        const {gateway = '', gateway_payment_method_meta = {}} = res;

        const gatewayName = gateway.toLowerCase();
        switch (gatewayName) {
          case Gateway.RAZORPAY:
            if (gateway_payment_method_meta.paymentMethod === 'netbanking_emandates') {
              const bankArr = gateway_payment_method_meta.issuers.filter((obj) =>
                obj.auth_types.myArrayList.includes('netbanking')
              );
              resolve(bankArr);
            } else {
              reject(new CbError());
            }
            break;
        }
      });
    });
  }

  fetchGatewayDetails(options: any): Promise<any> {
    const paymentIntent = this.getPaymentIntent();
    const currency = (options && options.currency) || (paymentIntent && paymentIntent.currency_code);
    const reqData = {
      currency: currency,
      paymentMethodType: 'netbanking_emandates',
    };
    const gatewayAccountId =
      (options && options.gateway_account_id) || (paymentIntent && paymentIntent.gateway_account_id);

    reqData['gatewayAccountId'] = gatewayAccountId;

    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.GetDotpayGatewayDetails,
          data: reqData,
        },
        Ids.MASTER_FRAME,
        {timeout: 10000}
      )
    );
  }

  initPayment() {
    return Promise.resolve({
      paymentMethodType: PaymentMethodType.Netbanking_EMANDATES,
      bankAccount: this.paymentInfo.bankAccount,
      customer: this.paymentInfo.customer,
      paymentType: this.paymentInfo.additionalData && this.paymentInfo.additionalData.paymentType,
      shippingAddress: this.getShippingAddress(),
    });
  }

  setWindowPopup() {
    const windowManager = new CbWindowManager();
    windowManager.openDirect('', PAYMENT_AUTH_REDIRECT_WINDOW_NAME, {
      skipReferrer: true,
      showLoader: true,
      openInNewWindow: true,
      closeCallback: () => fetchPaymentIntentStatus(this.gatewayHandler.getPaymentIntent()),
    });
    this.setWindowManager(windowManager);
  }

  /**
   * TODO: to consume handlePayment in payment intent handler,
   * once paymentIntent is accepted as part of payment options
   * @param paymentInfo
   * @param callbacks
   * @returns
   */
  handlePayment(paymentInfo: PaymentInfo, callbacks?: Callbacks): Promise<any> {
    this.setWindowPopup();
    return this.getGatewayHandler(this.getPaymentIntent()).then((handler) => {
      this.gatewayHandler = handler;
      return handler.initiateAuthorization(paymentInfo, callbacks);
    });
  }
}
