import {PaymentMethodType, Customer, PaymentAttemptStatus} from '@/internal/payment-intent/types';
import KlarnaHandler from '@/plugins/payments/klarna/handlers';
import type {PaymentInfo as KlarnaPaymentInfo} from '@/plugins/payments/klarna/types';
import {isObjectEmpty} from '@/utils/utility-functions';
import {sanitizeCustomerInfo} from '@/internal/common/utils';
import {retrievePaymentIntent} from '@/internal/payment-intent/handler';
import ErrorCodes, {CbError} from '@/hosted_fields/common/errors';
import {sendToMasterIframe} from '@/hosted_fields/host/iframe-client-loader';
import {Master as M} from '@/hosted_fields/common/enums';

type RuntimeKlarnaAdditionalData = NonNullable<KlarnaPaymentInfo['additionalData']> & {
  invoiceId?: number | string;
  lineItems?: unknown[];
  paymentType?: string;
  subscriptionEstimateJson?: string;
  subscriptionMandateHandle?: string;
  customer?: Customer;
};

type RuntimeKlarnaPaymentInfo = KlarnaPaymentInfo & {
  additionalData?: RuntimeKlarnaAdditionalData;
  additionalInfo?: Record<string, string>;
  retainPaymentMethod?: boolean;
};

/**
 * Builds Stripe Klarna's confirm payload and manages its pre-opened authorization
 * popup. Keep dismissal here: other Klarna gateways own different authorization UIs.
 *
 * The caller (hosted checkout or a merchant's Payment Components integration)
 * supplies the subscription cadence. It is forwarded independently of cart data,
 * trial estimates, or intent amount.
 */
export default class StripeKlarnaHandler extends KlarnaHandler {
  private popupPoll?: Promise<any>;
  private stopWorkerTask?: Promise<any>;

  constructor(handler: KlarnaHandler, ...args) {
    super(...args);
    this.windowManager = handler.windowManager;
    this.isRedirectMode = handler.isRedirectMode;
    this.isIframeMode = handler.isIframeMode;
  }

  private isPopupMode(): boolean {
    return !!this.windowManager && !this.isRedirectMode && !this.isIframeMode;
  }

  private popupClosedError(): CbError {
    return new CbError({
      name: 'PAYMENT_WINDOW_CLOSED',
      code: 'paymentWindowClosed',
      message: 'The payment window was closed before authorization completed.',
    });
  }

  protected confirmPayment(data: any = {}): Promise<any> {
    if (this.isPopupMode()) {
      if (this.windowManager.window && this.windowManager.window.closed) {
        return Promise.reject(this.popupClosedError());
      }
      if (this.windowManager.isBlocked()) {
        return Promise.reject(new CbError(ErrorCodes.popupBlocked));
      }
    }
    return super.confirmPayment(data);
  }

  protected handlePaymentAttemptStatus(status: PaymentAttemptStatus) {
    if (
      this.isPopupMode() &&
      (status === PaymentAttemptStatus.REQUIRES_CHALLENGE || status === PaymentAttemptStatus.REQUIRES_REDIRECTION) &&
      this.windowManager.window &&
      this.windowManager.window.closed
    ) {
      // The pre-opened blank window can close while confirm is still in flight.
      // Reconcile that outcome without trying to navigate the closed window.
      return this.pollForAuthCompletion().then((response) => {
        this.setPaymentIntent(response.payment_intent);
        return super.handlePaymentAttemptStatus(this.getPaymentAttempt().status);
      });
    }
    return super.handlePaymentAttemptStatus(status);
  }

  private stopWorkerPolling(): Promise<any> {
    if (!this.stopWorkerTask) {
      // Confirm starts the shared worker. Stop it before creating a drain waiter,
      // so a late worker result cannot settle that waiter and leave its timer alive.
      this.stopWorkerTask = this.stopPoll({payment_intent: this.getPaymentIntent()}).then(() =>
        // StopPoll stores a result until a waiter consumes it. Drain it before
        // retry; the base poll helper cannot be used because it also closes the popup.
        sendToMasterIframe(
          M.Actions.PollPaymentIntent3DSResult,
          {paymentIntentId: this.getPaymentIntent().id},
          {timeout: this.redirectTimeout}
        )
      );
    }
    return this.stopWorkerTask;
  }

  protected pollForAuthCompletion() {
    if (!this.isPopupMode()) return super.pollForAuthCompletion();
    if (this.popupPoll) return this.popupPoll;

    // Klarna owns this serial retrieve loop so popup dismissal and a same-intent
    // retry do not depend on shared worker callbacks or change other payment methods.
    // The cancellable delay follows the Stripe UPI handler's polling pattern.
    this.popupPoll = this.stopWorkerPolling().then((drainedResponse) => {
      const drainedAttempt =
        drainedResponse && drainedResponse.payment_intent && drainedResponse.payment_intent.active_payment_attempt;
      // The return page can replace the stop record with a terminal result before
      // the drain consumes it. Preserve that outcome without another retrieve.
      if (
        drainedAttempt &&
        (drainedAttempt.status === PaymentAttemptStatus.AUTHORIZED ||
          drainedAttempt.status === PaymentAttemptStatus.REFUSED)
      ) {
        return drainedResponse;
      }
      return new Promise((resolve, reject) => {
        let settled = false;
        let closing = false;
        let retrieveFailures = 0;
        let pollTimer: ReturnType<typeof setTimeout>;
        let deadline: ReturnType<typeof setTimeout>;
        const finish = (response?: any, error?: any) => {
          if (settled) return;
          settled = true;
          clearTimeout(pollTimer);
          clearTimeout(deadline);
          if (error) reject(error);
          else resolve(response);
        };
        const retrieve = (afterClose = false) => {
          retrievePaymentIntent(this.getPaymentIntent().id)
            .then((response) => {
              if (settled) return;
              const attempt = response && response.payment_intent && response.payment_intent.active_payment_attempt;
              if (!attempt) {
                if (afterClose || !closing) finish(undefined, new CbError(ErrorCodes.invalidPaymentIntent));
                return;
              }
              // An in-flight regular retrieve may observe authorization while
              // the fresh close-time retrieve is pending. Preserve that result.
              if (
                attempt &&
                (attempt.status === PaymentAttemptStatus.AUTHORIZED || attempt.status === PaymentAttemptStatus.REFUSED)
              ) {
                finish(response);
              } else if (afterClose) {
                finish(undefined, this.popupClosedError());
              } else if (!closing) {
                pollTimer = setTimeout(() => retrieve(), 3000);
              }
            })
            .catch((error) => {
              if (settled) return;
              // Once closing, only the fresh close-time request may report a
              // retrieval failure; older requests must not interfere with retry.
              if (afterClose) finish(undefined, error);
              else if (!closing) {
                // Preserve the shared worker's three-failure allowance for
                // ordinary polling, so a transient request failure is retryable.
                if (++retrieveFailures >= 3) finish(undefined, new CbError('Poll Timeout'));
                else pollTimer = setTimeout(() => retrieve(), 3000);
              }
            });
        };
        const onClose = () => {
          if (settled || closing) return;
          closing = true;
          clearTimeout(pollTimer);
          // Reuse the retrieve-on-close reconciliation from Razorpay redirects:
          // the return page may close itself before regular polling sees success.
          retrieve(true);
        };
        deadline = setTimeout(() => finish(undefined, new CbError('Poll Timeout')), this.redirectTimeout);
        this.windowManager.watchClose(onClose);
        if (!this.windowManager.window || this.windowManager.window.closed) onClose();
        else retrieve();
      });
    });
    return this.popupPoll;
  }

  // Constructs the confirm payload from the caller's paymentInfo.
  // Each field is optional; missing fields are omitted from the payload rather than sent as null.
  initPayment() {
    const paymentInfo = this.paymentInfo as RuntimeKlarnaPaymentInfo | undefined;
    const additionalData = paymentInfo && paymentInfo.additionalData;
    const subscription = additionalData && additionalData.subscription;
    const invoiceIdRaw = additionalData && additionalData.invoiceId;
    const customer = paymentInfo && paymentInfo.customer;
    const email = (customer && customer.email) || (additionalData && additionalData.email) || null;
    const lineItems = additionalData && additionalData.lineItems;
    const paymentType = additionalData && additionalData.paymentType;
    const subEstJson =
      additionalData && typeof additionalData.subscriptionEstimateJson === 'string'
        ? additionalData.subscriptionEstimateJson
        : undefined;
    const mandateHandle =
      additionalData && typeof additionalData.subscriptionMandateHandle === 'string'
        ? additionalData.subscriptionMandateHandle
        : undefined;

    let invoiceId: number | undefined;
    if (invoiceIdRaw != null && invoiceIdRaw !== '') {
      const n = typeof invoiceIdRaw === 'number' ? invoiceIdRaw : Number(invoiceIdRaw);
      if (Number.isFinite(n)) {
        invoiceId = n;
      }
    }
    const extraInfo = paymentInfo && paymentInfo.additionalInfo;
    const mergedAdditionalInfo: Record<string, string> = {
      ...(typeof extraInfo === 'object' && extraInfo ? extraInfo : {}),
      ...(subEstJson ? {subscriptionEstimateJson: subEstJson} : {}),
      ...(mandateHandle ? {subscriptionMandateHandle: mandateHandle} : {}),
    };
    const hasAdditionalInfoKeys = Object.keys(mergedAdditionalInfo).length > 0;

    const billForPm = this.getCustomerBillingAddress() || this.getCardBillingAddress();
    const paymentMethodDetails: Record<string, unknown> = {};
    if (email) {
      paymentMethodDetails.email = email;
    }
    if (billForPm && !isObjectEmpty(billForPm)) {
      paymentMethodDetails.billingAddress = {...billForPm};
    }

    const confirmData: any = {
      paymentMethodType: PaymentMethodType.KLARNA,
      ...(subscription && {subscription: {...subscription}}),
      ...(invoiceId != null ? {invoiceId} : {}),
      ...(Array.isArray(lineItems) && lineItems.length
        ? {lineItems: lineItems.map((lineItem) => ({...(lineItem as Record<string, unknown>)}))}
        : {}),
      ...(paymentType ? {paymentType} : {}),
      ...(hasAdditionalInfoKeys ? {additionalInfo: mergedAdditionalInfo} : {}),
    };
    if (!isObjectEmpty(paymentMethodDetails)) {
      confirmData.paymentMethodDetails = paymentMethodDetails;
    }

    const shippingAddress = this.getShippingAddress();
    if (shippingAddress && !isObjectEmpty(shippingAddress)) {
      confirmData.shippingAddress = {...shippingAddress};
    }
    const customerBillingAddress = this.getCustomerBillingAddress();
    if (customerBillingAddress && !isObjectEmpty(customerBillingAddress)) {
      confirmData.customerBillingAddress = {...customerBillingAddress};
    }

    const additionalCustomer =
      additionalData && additionalData.customer ? (additionalData.customer as Customer) : undefined;
    const mergedCustomer = sanitizeCustomerInfo({
      ...(additionalCustomer || {}),
      ...(customer || {}),
    } as Customer);
    if (
      !isObjectEmpty(mergedCustomer) &&
      (mergedCustomer.firstName || mergedCustomer.lastName || mergedCustomer.phone)
    ) {
      confirmData.customer = mergedCustomer;
    }

    if (
      (typeof paymentType === 'string' && paymentType.toUpperCase() === 'ONETIME') ||
      (paymentInfo && paymentInfo.retainPaymentMethod === false)
    ) {
      confirmData.retainPaymentMethod = false;
    }
    return Promise.resolve(confirmData);
  }
}
