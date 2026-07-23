import ThreeDSecureHandler from '@/extensions/three_domain_secure/index';
import AbstractThreeDSecureHandler from '@/extensions/three_domain_secure/handlers/abstract';
import Errors, {CbError} from '@/hosted_fields/common/errors';
import {validateRawCardDetails} from '@/extensions/three_domain_secure/common/utils';
import {
  PaymentAttempt,
  PaymentAttemptStatus,
  PaymentIntentResponse,
  PaymentMethodType,
} from '@/extensions/three_domain_secure/common/types';
import Utils from '@/utils/payments/utils';

type ChallengeWindowSize = '01' | '02' | '03' | '04' | '05';

/**
 * Ecentric3DSHandler — 3DS1 ACS iframe flow.
 *
 * Flow:
 *  1. confirmPayment → backend returns REQUIRES_CHALLENGE with action_payload
 *  2. getEcentricChallengeFields extracts acs_url, PaReq, MD, TermUrl
 *  3. buildAndPostFormToIframe creates an iframe, POSTs PaReq to AcsUrl targeting it
 *  4. Ecentric HPP/ACS runs inside the iframe, POSTs PaRes to TermUrl (server-side)
 *  5. chargebee-app handles TermUrl callback and runs paymentVerify
 *  6. pollFor3DSCompletion waits for the payment intent to reach a terminal status
 */
export default class Ecentric3DSHandler extends AbstractThreeDSecureHandler {
  constructor(parent: ThreeDSecureHandler) {
    super(parent);
  }

  validate(): boolean {
    const hasRawCard = !!this.paymentInfo.card;
    const hasReferenceId = !!this.getReferenceId();
    const hasCardComponent = !!this.paymentInfo.cardComponent;
    const hasPaymentComponent = !!this.paymentInfo.paymentComponent;
    const hasCbToken = !!this.paymentInfo.cbToken;

    if (!hasRawCard && !hasReferenceId && !hasCardComponent && !hasPaymentComponent && !hasCbToken) {
      this.kvl({action: 'ecentric_3ds_validate', result: 'missing_payment_info'});
      throw new CbError(Errors.missingCardDetails);
    }
    if (hasRawCard) {
      validateRawCardDetails(this.paymentInfo.card);
    }
    return true;
  }

  handlePayment(): void {
    this.handlePaymentFlow().catch((err) => {
      this.kvl({action: 'ecentric_3ds_handle_payment', result: 'failed'});
      this.callError(err instanceof CbError ? err : new CbError(err));
      this.closeWindowIfOpen();
    });
  }

  closeWindowIfOpen() {
    this.parent && this.parent.closeTab();
  }

  getConfirmPayload(paymentData: Record<string, unknown>): Record<string, unknown> {
    const custBillingAddress = this.getCustomerBillingAddress() || {};
    const pmBillingAddress = this.getCardBillingAddress() || {};

    return {
      paymentMethodType: PaymentMethodType.CARD,
      ...Utils.getBrowserFingerprint(),
      customer: {
        ...(this.getCustomerInfo() ? this.getCustomerInfo() : {}),
        firstName: custBillingAddress.firstName,
        lastName: custBillingAddress.lastName,
        billingAddress: custBillingAddress,
      },
      shippingAddress: this.getShippingAddress(),
      paymentMethodDetails: {
        ...paymentData,
        firstName: pmBillingAddress.firstName,
        lastName: pmBillingAddress.lastName,
        billingAddress: pmBillingAddress,
      },
    };
  }

  handlePaymentFlow(): Promise<any> {
    if (this.paymentInfo.card) {
      return this.cardFlow();
    }
    if (this.getReferenceId()) {
      return this.referenceIdFlow();
    }
    if (this.paymentInfo.cardComponent) {
      return this.cardComponentFlow();
    }
    if (this.paymentInfo.paymentComponent) {
      return this.paymentComponentFlow();
    }
    if (this.paymentInfo.cbToken) {
      return this.cbTokenFlow();
    }
    this.kvl({action: 'ecentric_3ds_handle_payment', result: 'missing_payment_flow'});
    return Promise.reject(new CbError(Errors.missingCardDetails));
  }

  cardFlow() {
    return this.confirmPayment(this.getConfirmPayload(this.paymentInfo));
  }

  referenceIdFlow() {
    return this.confirmPayment(this.getConfirmPayload({}));
  }

  cardComponentFlow() {
    return this.confirmPayment(
      this.getConfirmPayload({
        cardComponent: this.paymentInfo.cardComponent,
      })
    );
  }

  paymentComponentFlow() {
    return this.confirmPayment(
      this.getConfirmPayload({
        paymentComponent: this.paymentInfo.paymentComponent,
      })
    );
  }

  cbTokenFlow() {
    return this.confirmPayment(
      this.getConfirmPayload({
        cbToken: this.paymentInfo.cbToken,
      })
    );
  }

  protected async handlePaymentAttempt(paymentAttempt: PaymentAttempt): Promise<any> {
    this.kvl({
      action: 'ecentric_3ds_handle_payment_attempt',
      attempt_id: paymentAttempt.id,
      attempt_status: paymentAttempt.status,
    });

    switch (paymentAttempt.status) {
      case PaymentAttemptStatus.AUTHORIZED:
        this.kvl({action: 'ecentric_3ds_authorized', attempt_id: paymentAttempt.id});
        this.callSuccess();
        return Promise.resolve(true);

      case PaymentAttemptStatus.REQUIRES_CHALLENGE:
      case PaymentAttemptStatus.REQUIRES_REDIRECTION:
        this.callChange();
        return this.do3DSVerification(paymentAttempt).then((data) => {
          return this.handlePaymentAttempt(data);
        });

      case PaymentAttemptStatus.REFUSED:
      default:
        throw this.intentError();
    }
  }

  /**
   * Opens the LightBox modal (same overlay used by Adyen, Stripe, etc.), then POSTs the
   * ACS form into it. The form is removed after submit; the iframe stays for the ACS flow.
   */
  private buildAndPostFormToIframe(actionUrl: string, fields: Record<string, string>) {
    const iframe = this.createIframe();
    this.openIframe();

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = actionUrl;
    form.target = iframe.name;

    Object.entries(fields).forEach(([k, v]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = k;
      input.value = v;
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  }

  /**
   * Merge OpenPay / gateway shapes: top-level action_payload, attempt.openpay_action_payload,
   * and nested `redirect` objects.
   */
  private getMergedChallengeRaw(paymentAttempt: PaymentAttempt): Record<string, any> {
    const attempt = paymentAttempt as PaymentAttempt & {openpay_action_payload?: Record<string, any>};
    const base = Object.assign({}, attempt.action_payload || {}, attempt.openpay_action_payload || {});
    const redirect = base.redirect;
    if (redirect && typeof redirect === 'object') {
      return Object.assign({}, base, redirect);
    }
    return base;
  }

  private getEcentricChallengeFields(raw: Record<string, any>): {
    acsUrl: string;
    paReq: string;
    md?: string;
    termUrl?: string;
    challengeWindowSize?: ChallengeWindowSize;
  } | null {
    if (!raw) {
      return null;
    }

    const acsUrl = raw.acs_url || raw.acsUrl || raw.AcsUrl;

    let paReq = raw.PaReq;
    if (paReq == null) paReq = raw.pa_req;
    if (paReq == null) paReq = raw.PAReq;
    if (paReq == null) paReq = raw.paReq;
    if (paReq == null) paReq = raw.paReqPayload;
    if (paReq == null) paReq = raw.PAReqPayload;

    let md = raw.MD;
    if (md == null) md = raw.md;

    let termUrl = raw.TermUrl;
    if (termUrl == null) termUrl = raw.term_url;
    if (termUrl == null) termUrl = raw.termUrl;

    const challengeWindowSize = raw.challengeWindowSize as ChallengeWindowSize | undefined;

    if (!acsUrl || !paReq) {
      return null;
    }

    return {
      acsUrl,
      paReq: String(paReq),
      md: md != null && md !== '' ? String(md) : undefined,
      termUrl: termUrl != null && termUrl !== '' ? String(termUrl) : undefined,
      challengeWindowSize,
    };
  }

  private do3DSVerification(paymentAttempt: PaymentAttempt): Promise<any> {
    const raw = this.getMergedChallengeRaw(paymentAttempt);
    const fields = this.getEcentricChallengeFields(raw);

    this.kvl({
      action: 'ecentric_3ds_verification',
      result: 'started',
      attempt_status: paymentAttempt.status,
      merged_payload_keys: raw ? Object.keys(raw) : [],
    });

    if (!fields) {
      this.kvl({
        action: 'ecentric_3ds_acs_form',
        result: 'skipped',
        reason: 'missing_required_fields',
        attempt_status: paymentAttempt.status,
        payload_keys: raw ? Object.keys(raw) : [],
        has_acs_url: !!(raw && (raw.acs_url || raw.acsUrl || raw.AcsUrl)),
        has_pa_req: !!(
          raw &&
          (raw.PaReq != null ||
            raw.pa_req != null ||
            raw.PAReq != null ||
            raw.paReq != null ||
            raw.paReqPayload != null ||
            raw.PAReqPayload != null)
        ),
      });
      return Promise.reject(
        new CbError(Errors.unknownPaymentAttemptStatus, {
          detail: 'Ecentric 3DS challenge missing acs_url or pa_req',
        })
      );
    }

    // Ecentric registers TermUrl + MD during the Secure3DLookup, so the ACS form needs only PaReq.
    const formFields: Record<string, string> = {
      PaReq: fields.paReq,
    };

    this.kvl({
      action: 'ecentric_3ds_acs_form',
      result: 'submitted',
      has_md: !!fields.md,
      has_term_url: !!fields.termUrl,
      pa_req_length: fields.paReq ? fields.paReq.length : 0,
    });

    this.buildAndPostFormToIframe(fields.acsUrl, formFields);

    this.kvl({action: 'ecentric_3ds_poll', result: 'started', payment_intent_id: this.getPaymentIntent().id});

    return this.pollFor3DSCompletion()
      .then((data: PaymentIntentResponse) => {
        const attempt = data && data.payment_intent && data.payment_intent.active_payment_attempt;
        this.kvl({
          action: 'ecentric_3ds_poll',
          result: 'succeeded',
          attempt_status: attempt && attempt.status,
          payment_intent_status: data && data.payment_intent && data.payment_intent.status,
        });
        if (!attempt || !attempt.status) {
          throw new CbError(Errors.unknownPaymentAttemptStatus);
        }
        return attempt;
      })
      .catch((err) => {
        this.kvl({action: 'ecentric_3ds_poll', result: 'failed'});
        throw err;
      })
      .finally(() => this.removeIframe());
  }
}
