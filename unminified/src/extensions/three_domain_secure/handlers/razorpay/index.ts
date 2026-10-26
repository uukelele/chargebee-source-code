import Errors, {CbError} from '@/hosted_fields/common/errors';
import AbstractThreeDSecureHandler from '../abstract';
import {validateRawCardDetails} from '@/extensions/three_domain_secure/common/utils';
import {PaymentAttempt, PaymentAttemptStatus, AdditionalData} from '@/plugins/three_domain_secure/types';
import {PaymentIntent} from '@/extensions/three_domain_secure/common/types';
import {getCurrencyDivisor} from '@/utils/utility-functions';
import {fetchPaymentIntentStatus} from '@/utils/payments/razorpay';
import {
  openOtpChallengeInIframe,
  OtpIframeCanceledError,
  OtpIframeTimeoutError,
  OTP_IFRAME_TIMEOUT_MS,
} from '@/utils/payments/otp-iframe';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import {Master as M} from '@/hosted_fields/common/enums';
import Ids from '@/constants/ids';
import {constructPaymentIntentApiPayload} from '@/internal/common/utils';
import {ConfirmApiInputPayload, PaymentIntentResponse} from '@/internal/payment-intent/types';
import {PAYMENT_AUTH_REDIRECT_WINDOW_NAME} from '@/hosted_fields/common/base-types';
import CbWindowManager from '@/models/cb-window-manager';
import Utils from '@/utils/payments/utils';

export default class Razorpay3DSHandler extends AbstractThreeDSecureHandler {
  private gatewayCredential: any;
  private cardOtpFlowEnabled = false;
  // Resolved once the pre-opened bank tab exists. Confirm waits on this so a blocked popup
  // can be recovered by the consent overlay before the payment continues.
  private bankWindowReady: Promise<boolean> = Promise.resolve(true);
  // The customer closed the bank tab or the consent overlay.
  private customerClosedBankWindow = false;
  // Set while we close the bank tab. The close watcher cannot tell that apart from the customer
  // closing it, and must not report a cancel after the payment has already finished.
  private suppressBankWindowCancel = false;
  // The customer close is handled once. A second watcher tick must not cancel again.
  private bankCloseHandled = false;

  validate(): boolean {
    const hasRawCard = !!this.paymentInfo.card;
    const hasReferenceId = !!this.getReferenceId();
    const hasCardComponent = !!this.paymentInfo.cardComponent;
    const hadPaymentComponent = !!this.paymentInfo.paymentComponent;
    if (!hasRawCard && !hasReferenceId && !hasCardComponent && !hadPaymentComponent) {
      throw new CbError(Errors.missingRazorPayPaymentInfo);
    }

    if (hasRawCard) {
      validateRawCardDetails(this.paymentInfo.card);

      if (!this.paymentInfo.card.firstName && !this.paymentInfo.card.lastName) {
        throw new CbError(Errors.missingRazorPayCardHolderInfo);
      } else if (!this.getCustomerInfo().email) {
        throw new CbError(Errors.missingRazorPayEmailInfo);
      } else if (!this.getCustomerInfo().phone) {
        throw new CbError(Errors.missingRazorPayPhoneInfo);
      }
    }
    return true;
  }

  getPaymentFlow(): Promise<any> {
    let paymentflow;
    if (this.paymentInfo.card) {
      paymentflow = this.cardFlow();
    } else if (this.getReferenceId()) {
      paymentflow = this.referenceIdFlow();
    } else if (this.paymentInfo.cardComponent) {
      paymentflow = this.cardComponentFlow();
    } else if (this.paymentInfo.paymentComponent) {
      paymentflow = this.paymentComponentFlow();
    }
    return paymentflow;
  }

  handlePayment() {
    this.customerClosedBankWindow = false;
    this.bankCloseHandled = false;
    const paymentflow = this.getPaymentFlow();
    if (paymentflow) {
      paymentflow
        .catch((err) => {
          if (err && (err.statusCode === 'CANCELED' || err.name === 'OtpIframeCanceledError')) {
            this.callCancel();
            return;
          }
          this.callError(err instanceof CbError ? err : new CbError(err));
        })
        .finally(() => {
          this.closeWindowIfOpen();
        });
    }
  }

  closeWindowIfOpen() {
    this.suppressBankWindowCancel = true;
    this.parent && this.parent.closeTab();
  }

  protected callCancel(): Promise<void> {
    this.customerClosedBankWindow = true;
    return super.callCancel();
  }

  private isCanceled(): boolean {
    return this.customerClosedBankWindow;
  }

  private getAdditionalParams(): AdditionalData {
    let data: AdditionalData = {};
    const additionalData = this.paymentInfo.additionalData;
    if (additionalData) {
      data.cardBillingAddress = this.getCardBillingAddress();
      data.billingAddress = this.getCardBillingAddress();
      data.customerBillingAddress = this.getCustomerBillingAddress();
      data.shippingAddress = this.getShippingAddress();
      data.plan = additionalData.plan;
      data.customer = this.getCustomerInfo();
      data.paymentType = additionalData.paymentType;
    }
    if (!data.customer) {
      data.customer = {email: ''};
    } else if (data.customer && !data.customer.email) {
      data.customer.email = '';
    }
    return data;
  }

  cardFlow() {
    const payload = {
      paymentMethod: this.paymentInfo.card,
      ...this.getAdditionalParams(),
    };
    return this.confirmAfterCheckingOtpPref(payload);
  }

  referenceIdFlow() {
    return this.confirmPayment({});
  }

  cardComponentFlow() {
    const payload: any = {
      ...this.getAdditionalParams(),
      cardComponent: this.paymentInfo.cardComponent,
    };
    return this.confirmAfterCheckingOtpPref(payload);
  }

  paymentComponentFlow() {
    const payload: any = {
      ...this.getAdditionalParams(),
      paymentComponent: this.paymentInfo.paymentComponent,
    };
    return this.confirmAfterCheckingOtpPref(payload);
  }

  private withOtpBrowserContext(payload: any) {
    return {
      ...payload,
      origin: (window.location && (window.location.origin || window.location.href)) || '',
      browserDetails: {
        ...Utils.getBrowserDetails(),
        javaScriptEnabled: true,
      },
    };
  }

  private confirmAfterCheckingOtpPref(payload: any): Promise<any> {
    // Pre-open while the click's user gesture is still valid, but without the consent overlay:
    // we don't yet know a 3DS challenge needs this tab, and a frictionless payment never will.
    // redirectToBank shows the overlay to recover a block once a challenge actually needs it.
    this.openNewWindowForRazorpay(false);
    return this.loadGatewayCredential()
      .catch((err) => {
        this.kvl({
          action: 'razorpay_credential_fetch_failed',
          error: err && err.message,
        });
        return {};
      })
      .then((credential) => {
        this.cardOtpFlowEnabled = this.isCardOtpFlowEnabled(credential);
        this.kvl({
          action: 'razorpay_card_otp_flow',
          card_otp_flow: this.cardOtpFlowEnabled,
        });
        return this.bankWindowReady.then(() => {
          if (this.isCanceled()) {
            return;
          }
          return this.confirmPayment(this.cardOtpFlowEnabled ? this.withOtpBrowserContext(payload) : payload);
        });
      });
  }

  private loadGatewayCredential(): Promise<any> {
    if (this.gatewayCredential) {
      return Promise.resolve(this.gatewayCredential);
    }
    return this.fetchGatewayCredential().then((credential) => {
      this.gatewayCredential = credential || {};
      return this.gatewayCredential;
    });
  }

  private isCardOtpFlowEnabled(credential: any): boolean {
    return !!(credential && (credential.card_otp_flow === true || credential.card_otp_flow === 'true'));
  }

  protected handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.REQUIRES_CHALLENGE:
        // The customer already closed the bank tab. Do not open it again for this challenge.
        if (this.isCanceled()) {
          return Promise.resolve(false);
        }
        this.callChange();
        if (this.isOtpChallenge(paymentAttempt)) {
          return this.handleOtpChallenge();
        }
        return this.completeOnBankPage(paymentAttempt);
      case PaymentAttemptStatus.AUTHORIZED:
        this.callSuccess();
        return Promise.resolve(true);
      case PaymentAttemptStatus.REFUSED:
        this.closeWindowIfOpen();
        throw this.intentError();
      default:
        throw this.intentError();
    }
  }

  private isOtpChallenge(paymentAttempt: PaymentAttempt): boolean {
    if (!this.cardOtpFlowEnabled) {
      return false;
    }
    const payload = paymentAttempt && paymentAttempt.action_payload;
    return !!(payload && (payload.otp_required === true || payload.otp_required === 'true'));
  }

  private handleOtpChallenge(): Promise<any> {
    this.kvl({action: 'razorpay_otp_challenge_started'});
    const paymentAttempt = this.getPaymentAttempt();
    const actionPayload = (paymentAttempt && paymentAttempt.action_payload) || {};
    // Pref was on and otp_generate succeeded: drop the pre-opened bank window and use the iframe,
    // rather than leave a loader tab parked behind the OTP page. "Complete on bank's page" opens
    // its own tab, and the click in the iframe carries user activation up to this page, so
    // redirectToBank can still open one there without tripping the popup blocker.
    this.closeWindowIfOpen();
    const intent = this.getPaymentIntent();
    const otpIframe = openOtpChallengeInIframe({
      amountLabel: intent ? this.formatOtpAmountLabel(intent) : '',
      cardLast4: this.getCardLast4(),
      redirectUrl: actionPayload.redirect_url,
      timeoutMs: OTP_IFRAME_TIMEOUT_MS,
      onResend: () =>
        this.submitOtpConfirm({
          additionalInfo: {details: {otp_action: 'resend'}},
        }).then(() => undefined),
    });

    const collectAndSubmit = (): Promise<any> => {
      return otpIframe.waitForCustomerAction().then((action) => {
        if (action.type === 'bank_page') {
          this.kvl({action: 'razorpay_otp_bank_page_redirect'});
          otpIframe.close();
          return this.completeOnBankPage(paymentAttempt);
        }
        return this.submitOtpConfirm({
          additionalInfo: {details: {otp: action.otp, otp_action: 'submit'}},
        })
          .then(() => {
            const attempt = this.getPaymentAttempt();
            if (attempt.status === PaymentAttemptStatus.AUTHORIZED) {
              otpIframe.close();
              this.callSuccess();
              this.kvl({action: 'razorpay_otp_authorized'});
              return true;
            }
            if (attempt.status === PaymentAttemptStatus.REFUSED) {
              otpIframe.close();
              throw this.intentError();
            }
            return this.pollFor3DSCompletion().then((data: PaymentIntentResponse) => {
              otpIframe.close();
              if (data && data.payment_intent) {
                this.setPaymentIntent(data.payment_intent);
              }
              return this.handlePaymentAttempt(this.getPaymentAttempt());
            });
          })
          .catch((err) => {
            if (
              err instanceof OtpIframeCanceledError ||
              err instanceof OtpIframeTimeoutError ||
              (err && (err.statusCode === 'CANCELED' || err.statusCode === 'TIMEOUT'))
            ) {
              throw err;
            }
            const attempt = this.getPaymentAttempt();
            if (attempt && attempt.status === PaymentAttemptStatus.REFUSED) {
              otpIframe.close();
              throw err instanceof CbError ? err : new CbError(err);
            }
            if (attempt && attempt.status === PaymentAttemptStatus.AUTHORIZED) {
              otpIframe.close();
              this.callSuccess();
              return true;
            }
            otpIframe.setError((err && err.message) || 'The OTP entered is invalid. Please try again.');
            return collectAndSubmit();
          });
      });
    };

    return collectAndSubmit().finally(() => {
      otpIframe.close();
    });
  }

  // Both the plain challenge and "Complete on bank's page" land here, so the OTP page hands the
  // customer over on exactly the terms the non-OTP flow already proved: redirectToBank owns the
  // tab, and its watchClose reports the real close instead of a guess at one.
  private completeOnBankPage(paymentAttempt: PaymentAttempt): Promise<any> {
    if (this.isCanceled()) {
      return Promise.resolve(false);
    }
    return this.redirectToBank(paymentAttempt).then((data) => {
      if (this.isCanceled()) {
        return false;
      }
      if (data && data['version_2']) {
        this.setPaymentIntent(data.payment_intent);
        return this.handlePaymentAttempt(this.getPaymentAttempt());
      }
      return this.confirmPayment(data);
    });
  }

  private formatOtpAmountLabel(intent: PaymentIntent): string {
    const divisor = getCurrencyDivisor(intent.currency_code);
    return `${intent.currency_code} ${(intent.amount / divisor).toFixed(2)}`;
  }

  private getCardLast4(): string {
    const card: any = this.paymentInfo && this.paymentInfo.card;
    const number = card && card.number ? String(card.number).replace(/\s/g, '') : '';
    if (number.length >= 4) {
      return number.slice(-4);
    }
    return (card && (card.last4 || card.lastFour)) || '****';
  }

  // OTP submit/resend must hit confirm so the backend can proxy Razorpay.
  // Do not use confirmPayment() here: that re-enters handlePaymentAttempt and would
  // open another OTP iframe. After submit, poll retrieve like other 3DS flows.
  private submitOtpConfirm(data: ConfirmApiInputPayload = {}): Promise<PaymentIntentResponse> {
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.ConfirmPaymentIntent,
          data: constructPaymentIntentApiPayload(this.getPaymentIntent(), data),
        },
        Ids.MASTER_FRAME,
        {timeout: 120000}
      )
    ).then((intentResponse: PaymentIntentResponse) => {
      intentResponse.payment_intent.active_payment_attempt.action_payload =
        intentResponse.action_payload || intentResponse.payment_intent.active_payment_attempt.action_payload;
      this.setPaymentIntent(intentResponse.payment_intent);
      return intentResponse;
    });
  }

  private redirectToBank(paymentAttempt: PaymentAttempt): Promise<any> {
    const redirectUrl = paymentAttempt.action_payload.redirect_url;
    // CHKOUTENGG-44063: We can't support redirectMode here because razorpay doesn't have redirect support
    // The tab is now known to be needed for the challenge: show the consent overlay to recover a
    // block, since the pre-open's click may no longer satisfy transient activation by this point.
    // loadBankUrl waits for that attempt to settle so a tab that only opens via the overlay still
    // gets navigated to the real URL, instead of being left on the blank loader page. If the tab
    // still isn't open, loadBankUrl is a no-op and polling continues regardless.
    this.openNewWindowForRazorpay(true);
    return this.bankWindowReady
      .then(() => {
        if (!this.isCanceled()) {
          this.loadBankUrl(redirectUrl);
        }
        return this.pollFor3DSCompletion();
      })
      .finally(() => {
        this.closeWindowIfOpen();
      });
  }

  // loadURL throws when the loader document has already navigated cross-origin.
  // Fall back to a fresh window.open, the same recovery CbWindowManager.open() uses.
  private loadBankUrl(url: string): void {
    const manager = this.parent && this.parent.windowManager;
    if (!manager) {
      return;
    }
    try {
      manager.loadURL(url);
    } catch (err) {
      window.open(url, 'cb-pages');
    }
  }

  private handleBankWindowClosed(): void {
    if (this.suppressBankWindowCancel || this.hasTerminalAttempt() || this.bankCloseHandled) {
      return;
    }
    this.bankCloseHandled = true;
    // The customer closed the tab directly, so CbWindowManager's watchClose callback fires but
    // never calls close()/resetWindow() itself (unlike every other path in this file that tears
    // the tab down). Without this, windowManager.windowOpened stays stale at true and the next
    // handlePayment()'s openNewWindowForRazorpay() wrongly believes a tab is already open and
    // skips reopening one.
    this.closeWindowIfOpen();
    // Set before dismissing the overlay. That dismiss rejects the consent promise, and
    // must not be reported as a second cancel.
    this.customerClosedBankWindow = true;
    // The copy we hold is still the pre-challenge intent. Razorpay can close the tab once the
    // payment is authorized, before the 3DS poll writes that result locally.
    // The main flow returns early once customerClosedBankWindow is set, so this chain is the only
    // place a REFUSED result gets reported.
    fetchPaymentIntentStatus(this.getPaymentIntent())
      .then((intent) => {
        if (intent) {
          this.setPaymentIntent(intent);
        }
        // AUTHORIZED reports success and REFUSED reports the payment error. A challenge that is
        // still open is the customer closing the tab.
        if (this.hasTerminalAttempt()) {
          return this.handlePaymentAttempt(this.getPaymentAttempt());
        }
        this.callCancel();
      })
      .catch((err) => {
        this.callError(err instanceof CbError ? err : new CbError(err));
      });
  }

  private hasTerminalAttempt(): boolean {
    const attempt = this.getPaymentAttempt();
    return (
      !!attempt &&
      (attempt.status === PaymentAttemptStatus.AUTHORIZED || attempt.status === PaymentAttemptStatus.REFUSED)
    );
  }

  // Reuses the tab already open for this attempt. windowOpened is set by CbWindowManager once
  // openDirect succeeds and cleared on close, so redirectToBank picks up the tab pre-opened by
  // confirmAfterCheckingOtpPref, and a tab closed for the OTP iframe gets reopened.
  private openNewWindowForRazorpay(enablePopupConsentOverlay = false): void {
    this.suppressBankWindowCancel = false;
    this.bankCloseHandled = false;
    const manager = this.parent && this.parent.windowManager;
    if (!manager || !manager.windowOpened) {
      this.bankWindowReady = this.openBankTabWithConsent(enablePopupConsentOverlay);
    }
  }

  private logOpenWindowFailed(err: any): void {
    this.kvl({
      action: 'razorpay_open_window_failed',
      error: (err && err.message) || String(err),
    });
  }

  // The first, speculative pre-open (confirmAfterCheckingOtpPref) keeps the overlay off: we don't
  // yet know a challenge needs this tab, and showing "Continue to payment" for a payment that
  // turns out frictionless would be confusing. redirectToBank re-requests this with the overlay
  // on once a challenge actually needs the tab, which is when a blocked window should show the
  // overlay instead of silently failing. Hosted checkout does not set enablePopupConsentOverlay
  // itself, so this handler decides when to turn it on rather than always forcing it.
  private openBankTabWithConsent(enablePopupConsentOverlay: boolean): Promise<boolean> {
    try {
      if (!this.parent || this.isCanceled()) {
        return Promise.resolve(false);
      }
      if (!this.parent.windowManager) {
        this.parent.setWindowManager(new CbWindowManager());
      }
      return Promise.resolve(
        this.parent.windowManager.openDirectWithConsent('', PAYMENT_AUTH_REDIRECT_WINDOW_NAME, {
          skipReferrer: true,
          showLoader: true,
          openInNewWindow: true,
          enablePopupConsentOverlay,
          closeCallback: () => this.handleBankWindowClosed(),
        })
      ).then(
        () => {
          // The customer may have cancelled while the overlay was waiting; drop the late tab.
          if (this.isCanceled()) {
            this.closeWindowIfOpen();
            return false;
          }
          return true;
        },
        (err) => (this.isCanceled() ? false : this.consentOpenFailed(err))
      );
    } catch (err) {
      return Promise.resolve(this.consentOpenFailed(err));
    }
  }

  private consentOpenFailed(err: any): boolean {
    const cause = err as {code?: string; message?: string};
    // The customer closed the consent dialog (close button or Escape). That is a cancel.
    // A dismiss we triggered ourselves, after the bank tab closed or cancel already ran, is not.
    if (cause && cause.code === 'popupConsentDismissed' && !this.suppressBankWindowCancel && !this.isCanceled()) {
      this.callCancel();
      this.closeWindowIfOpen();
      return false;
    }
    if (this.cardOtpFlowEnabled) {
      this.logOpenWindowFailed(err);
    }
    // popupBlocked is the retry-still-blocked result.
    return !(cause && cause.code === 'popupBlocked');
  }
}
