import Errors, {CbError} from '@/hosted_fields/common/errors';
import AbstractThreeDSecureHandler from '../abstract';
import {validateRawCardDetails} from '@/extensions/three_domain_secure/common/utils';
import {PaymentAttempt, PaymentAttemptStatus, AdditionalData} from '@/plugins/three_domain_secure/types';
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
import Utils from '@/utils/payments/utils';

export default class Razorpay3DSHandler extends AbstractThreeDSecureHandler {
  private gatewayCredential: any;
  private cardOtpFlowEnabled = false;

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
    this.parent && this.parent.closeTab();
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
        // Always pre-open the bank window so popup blockers do not block redirect.
        // If Razorpay returns otp_generate / otp_required, we close it and use the OTP iframe.
        this.openNewWindowForRazorpay();
        if (!this.cardOtpFlowEnabled) {
          return this.confirmPayment(payload);
        }
        return this.confirmPayment(this.withOtpBrowserContext(payload));
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
      amountLabel: intent ? `${intent.currency_code} ${intent.amount}` : '',
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
    return this.redirectToBank(paymentAttempt).then((data) => {
      if (data && data['version_2']) {
        this.setPaymentIntent(data.payment_intent);
        return this.handlePaymentAttempt(this.getPaymentAttempt());
      }
      return this.confirmPayment(data);
    });
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
    if (this.openNewWindowForRazorpay()) {
      this.parent.windowManager.loadURL(redirectUrl);
      this.parent.windowManager.watchClose(() => {
        fetchPaymentIntentStatus(this.getPaymentIntent());
        this.callCancel();
      });
    }

    return this.pollFor3DSCompletion()
      .then((data) => {
        return data;
      })
      .finally(() => {
        // Remove tab
        this.closeWindowIfOpen();
      });
  }

  // In the OTP flow the bank tab is best effort: a popup blocker leaves us with no window, and
  // embedded browsers such as Salesforce hand back one without a usable location, both of which
  // throw once the loader URL is assigned. The OTP iframe can still carry the payment, so log the
  // failure and report it. Without the OTP flow the tab is the only way through, so keep letting
  // the error surface.
  private openNewWindowForRazorpay(): boolean {
    const openWindow = () =>
      this.parent.openNewWindow({
        closeCallback: () => fetchPaymentIntentStatus(this.getPaymentIntent()),
      });

    if (!this.cardOtpFlowEnabled) {
      openWindow();
      return true;
    }

    try {
      openWindow();
    } catch (err) {
      const cause = err as Error;
      this.kvl({
        action: 'razorpay_open_window_failed',
        error: (cause && cause.message) || String(err),
      });
      return false;
    }
    if (!this.hasUsableBankWindow()) {
      this.kvl({
        action: 'razorpay_open_window_failed',
        error: 'bank window is unavailable or has no location',
      });
      return false;
    }
    return true;
  }

  private hasUsableBankWindow(): boolean {
    const windowManager = this.parent && this.parent.windowManager;
    const bankWindow = windowManager && windowManager.window;
    try {
      return !!(bankWindow && !bankWindow.closed && bankWindow.location);
    } catch (err) {
      return false;
    }
  }
}
