import AbstractGiropayHandler from '@/plugins/payments/giropay/handlers/abstract';
import CbInstanceOptions from '@/interfaces/cb-instance-options';
import AdyenGiropayHandler from '@/plugins/payments/giropay/handlers/adyen';
// TODO: REFACTOR, move common types out from 3DS and update imports
import {PaymentIntent, Options, Callbacks, Gateway} from '@/extensions/three_domain_secure/common/types';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {GiropayPayment, PaymentOptions} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import CbWindowManager from '@/models/cb-window-manager';

export default class GiropayHandler implements GiropayPayment {
  public site: string;
  public paymentIntent: PaymentIntent;
  public options: Options;
  public component: any;

  private giropayHandler: AbstractGiropayHandler;
  public windowManager: CbWindowManager;
  public isRedirectMode: boolean = false;

  constructor(chargebee: CbInstanceOptions) {
    this.site = chargebee.site;
  }

  setWindowManager(windowManager: CbWindowManager) {
    this.windowManager = windowManager;
  }

  setRedirectMode(val: boolean) {
    this.isRedirectMode = val;
  }

  validatePaymentIntent(intent: PaymentIntent): PaymentIntent {
    if (typeof intent !== 'object' || !(intent.id && intent.amount + '' && intent.status && intent.gateway))
      throw new CbError(Errors.invalidPaymentIntent);
    return intent;
  }

  handlePayment(options: PaymentOptions): Promise<any> {
    return options.paymentIntent().then((paymentIntent) => {
      this.paymentIntent = this.validatePaymentIntent(paymentIntent);
      if (!this.giropayHandler) {
        this.giropayHandler = this.getGiropayHandler(paymentIntent.gateway);
      }
      return this.giropayHandler.handleGiropayPayment(options.callbacks);
    });
  }

  private getGiropayHandler(gateway: Gateway): AbstractGiropayHandler {
    switch (gateway) {
      case Gateway.ADYEN:
        return new AdyenGiropayHandler(this);
    }
  }
}
