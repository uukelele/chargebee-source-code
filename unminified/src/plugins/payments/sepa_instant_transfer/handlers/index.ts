import {PaymentRedirectTimeouts} from '@/constants/enums';
import {SepaInstantTransferPayment, ComponentType} from '@/hosted_fields/common/base-types';
import PaymentIntentHandler from '@/internal/payment-intent/handler';
import {PaymentInfo} from '../../faster_payments/types';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {loadTranslations} from '@/helpers/translations';
import {loadDropDownComponent, updateDropDownComponent} from '@/utils/payments/gocardless';
import {PaymentMethodType} from '@/internal/payment-intent/types';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import Ids from '@/constants/ids';
import {Master as M} from '@/hosted_fields/common/enums';

export default class SepaInstantTransferHandler extends PaymentIntentHandler implements SepaInstantTransferPayment {
  protected declare paymentInfo: PaymentInfo;
  protected declare bankListComponent: any;
  redirectTimeout: number = PaymentRedirectTimeouts.SEPA_INSTANT_TRANSFER;

  constructor(...args) {
    super(...args);
  }

  mountBankList(id: string, options?: any): Promise<any> {
    return loadTranslations(options && options.locale).then(() => this.renderDefaultComponent(id, options));
  }

  renderDefaultComponent(id: string, options?: any): Promise<any> {
    const prevSelectedBank = this.getSelectedBank();

    return loadDropDownComponent(ComponentType.SepaInstantTransfer, options)
      .then((component) => {
        this.bankListComponent = component;
        return this.bankListComponent.mount(id);
      })
      .then(() => this.getBankList(options))
      .then((response) => updateDropDownComponent(response, prevSelectedBank));
  }

  getBankList(options: any): Promise<any> {
    const currency =
      (options && options.currency) || (this.getPaymentIntent() && this.getPaymentIntent().currency_code);

    const gatewayAccountId =
      (options && options.gatewayAccountId) || (this.getPaymentIntent() && this.getPaymentIntent().gateway_account_id);
    const countryCode = options && options.countryCode;

    if (!currency && !gatewayAccountId) {
      return Promise.reject(new CbError(Errors.eitherCurrencyOrGwAccIdRequiredForSepaInstantTransfer));
    }

    if (!countryCode) {
      return Promise.reject(new CbError(Errors.missingSepaInstantTransferCountryCode));
    }

    const reqData = {
      currency: currency,
      countryCode: countryCode,
      paymentMethodType: PaymentMethodType.SEPA_INSTANT_TRANSFER,
      gatewayAccountId: gatewayAccountId,
    };

    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.GetSepaInstantTransferGatewayDetails,
          data: reqData,
        },
        Ids.MASTER_FRAME,
        {timeout: 10000}
      )
    );
  }

  getSelectedBank() {
    return this.bankListComponent && this.bankListComponent.getSelectedBank();
  }

  handlePayment(options: any): Promise<any> {
    if (
      options &&
      options.paymentInfo &&
      options.paymentInfo.bankAccount &&
      !options.paymentInfo.bankAccount.institutionId
    ) {
      const selectedBank = this.getSelectedBank();
      options.paymentInfo.bankAccount.institutionId = selectedBank && selectedBank.id;
    }
    return super.handlePayment(options);
  }
}
