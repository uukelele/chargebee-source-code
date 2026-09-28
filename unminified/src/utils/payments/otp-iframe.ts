import LightBox from '@/extensions/three_domain_secure/common/lightbox';
import Helpers from '@/helpers';
import {CbError} from '@/hosted_fields/common/errors';

export const OTP_IFRAME_SOURCE = 'cb-otp-iframe';
export const OTP_HOST_SOURCE = 'cb-otp-host';
export const OTP_IFRAME_TIMEOUT_MS = 5 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_SECONDS = 30;

export type OtpIframeCopy = {
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  submittingLabel?: string;
  resendLabel?: string;
  cancelLabel?: string;
  placeholder?: string;
  merchantLabel?: string;
  amountLabel?: string;
  cardLast4?: string;
  completeOnBankLabel?: string;
};

export type OtpIframeOptions = OtpIframeCopy & {
  onResend?: () => Promise<void>;
  // Presence of a valid URL is what offers "Complete on gateway's page". The host does the
  // navigating, in the window it owns, so the page can be watched for close.
  redirectUrl?: string;
  timeoutMs?: number;
};

export class OtpIframeCanceledError extends CbError {
  statusCode: string;

  constructor(message = 'OTP verification was canceled') {
    super({name: 'OtpIframeCanceledError', message});
    this.name = 'OtpIframeCanceledError';
    this.statusCode = 'CANCELED';
    this.message = message;
  }
}

export class OtpIframeTimeoutError extends CbError {
  statusCode: string;

  constructor(message = 'OTP verification timed out') {
    super({name: 'OtpIframeTimeoutError', message});
    this.name = 'OtpIframeTimeoutError';
    this.statusCode = 'TIMEOUT';
    this.message = message;
  }
}

/**
 * What the customer did on the OTP page. Choosing the bank page is not a failure: the payment
 * stays in flight on the bank's site, so it resolves rather than rejecting.
 */
export type OtpIframeAction = {type: 'otp'; otp: string} | {type: 'bank_page'};

export type OtpIframeHandle = {
  // Rejects with OtpIframeCanceledError on cancel, OtpIframeTimeoutError when the session ends.
  waitForCustomerAction: () => Promise<OtpIframeAction>;
  setError: (message: string) => void;
  close: () => void;
};

const DEFAULT_COPY: Required<OtpIframeCopy> = {
  title: 'Enter OTP',
  subtitle: 'Enter the one-time password (OTP) sent to the phone number linked to your card.',
  submitLabel: 'Submit',
  submittingLabel: 'Verifying...',
  resendLabel: 'Resend OTP',
  cancelLabel: 'Cancel payment',
  placeholder: 'Enter OTP',
  merchantLabel: 'Paying to',
  amountLabel: '',
  cardLast4: '',
  completeOnBankLabel: "Complete on gateway's page",
};

export function openOtpChallengeInIframe(options: OtpIframeOptions = {}): OtpIframeHandle {
  const copy = {...DEFAULT_COPY, ...options};
  const timeoutMs =
    typeof options.timeoutMs === 'number' && options.timeoutMs > 0 ? options.timeoutMs : OTP_IFRAME_TIMEOUT_MS;
  const redirectUrl = safeHttpUrl(options.redirectUrl);
  const channelId = `cb-otp-${Helpers.genUuid()}`;
  const lightbox = new LightBox(`otp-${channelId}`);
  const iframe = lightbox.createIframe(`cb-otp-iframe-${channelId}`);
  iframe.classList.add('cb-otp-challenge-frame');
  const frameStyle = document.createElement('style');
  frameStyle.setAttribute('data-cb-otp-frame', channelId);
  frameStyle.appendChild(document.createTextNode(OTP_FRAME_HOST_STYLE));
  document.head.appendChild(frameStyle);
  lightbox.open();
  lightbox.hideLoader();
  iframe.setAttribute('title', copy.title);
  iframe.srcdoc = buildOtpIframeHtml(channelId, copy, timeoutMs, redirectUrl);

  let actionResolver: ((action: OtpIframeAction) => void) | null = null;
  let actionRejecter: ((err: Error) => void) | null = null;
  let closed = false;
  let closedReason: Error | null = null;
  let sessionTimeoutId: ReturnType<typeof setTimeout>;

  const postToIframe = (payload: Record<string, unknown>) => {
    if (!iframe.contentWindow) {
      return;
    }
    iframe.contentWindow.postMessage({source: OTP_HOST_SOURCE, channelId, ...payload}, '*');
  };

  const resolvePending = (action: OtpIframeAction) => {
    const resolve = actionResolver;
    actionResolver = null;
    actionRejecter = null;
    if (resolve) {
      resolve(action);
    }
  };

  const rejectPending = (err: Error) => {
    const reject = actionRejecter;
    actionResolver = null;
    actionRejecter = null;
    if (reject) {
      reject(err);
    }
  };

  const close = () => {
    if (closed) {
      return;
    }
    closed = true;
    clearTimeout(sessionTimeoutId);
    window.removeEventListener('message', onMessage);
    if (frameStyle.parentNode) {
      frameStyle.parentNode.removeChild(frameStyle);
    }
    lightbox.close();
    lightbox.destroy();
  };

  const endSessionWithError = (err: Error) => {
    closedReason = err;
    rejectPending(err);
    close();
  };

  const onMessage = (event: MessageEvent) => {
    const data = event && event.data;
    if (!data || data.source !== OTP_IFRAME_SOURCE || data.channelId !== channelId) {
      return;
    }
    if (data.type === 'submit') {
      resolvePending({type: 'otp', otp: String(data.otp || '').trim()});
      return;
    }
    if (data.type === 'resend') {
      Promise.resolve(options.onResend ? options.onResend() : undefined)
        .then(() => postToIframe({type: 'resend_done'}))
        .catch((err) => {
          postToIframe({
            type: 'error',
            message: (err && err.message) || 'Unable to resend OTP. Please try again.',
          });
        });
      return;
    }
    if (data.type === 'redirect') {
      resolvePending({type: 'bank_page'});
      return;
    }
    if (data.type === 'timeout') {
      endSessionWithError(new OtpIframeTimeoutError());
      return;
    }
    if (data.type === 'cancel') {
      rejectPending(new OtpIframeCanceledError());
    }
  };

  window.addEventListener('message', onMessage);
  sessionTimeoutId = setTimeout(() => {
    endSessionWithError(new OtpIframeTimeoutError());
  }, timeoutMs);

  return {
    waitForCustomerAction: () => {
      if (closed) {
        return Promise.reject(closedReason || new OtpIframeCanceledError());
      }
      return new Promise((resolve, reject) => {
        actionResolver = resolve;
        actionRejecter = reject;
      });
    },
    setError: (message: string) => {
      postToIframe({type: 'error', message});
    },
    close,
  };
}

const OTP_FRAME_HOST_STYLE = `
div[id^='cb-frame-wrapper-'] > iframe.cb-otp-challenge-frame {
  left: 0 !important;
  right: 0 !important;
  top: 0 !important;
  bottom: 0 !important;
  transform: none !important;
  width: 100% !important;
  height: 100% !important;
  box-shadow: none !important;
  border-radius: 0 !important;
  background: #e9f0fb !important;
}
`;

function buildOtpIframeHtml(
  channelId: string,
  copy: Required<OtpIframeCopy>,
  timeoutMs: number,
  redirectUrl: string
): string {
  const last4 = escapeHtml(copy.cardLast4);
  // A merchant with no configured name must not leave a visible "Paying to" label.
  const amountLabel = escapeHtml(copy.amountLabel);
  const displayAmountLabel = amountLabel.replace(/^([₹$])\s+/, '$1');
  const subtitle = escapeHtml(copy.subtitle);
  const submitLabel = escapeHtml(copy.submitLabel);
  const submittingLabel = escapeHtml(copy.submittingLabel);
  const resendLabel = escapeHtml(copy.resendLabel);
  const cancelLabel = escapeHtml(copy.cancelLabel);
  const placeholder = escapeHtml(copy.placeholder);
  const merchantLabel = escapeHtml(copy.merchantLabel);
  const completeOnBankLabel = escapeHtml(copy.completeOnBankLabel);
  const timeoutStart = formatTimeout(Math.floor(timeoutMs / 1000));
  const showBankLink = !!redirectUrl;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    html { height: 100%; }
    /* Vertical metrics scale with the frame height so the sheet fits without scrolling. */
    :root {
      --gap-xs: clamp(3px, .7vh, 8px);
      --gap-sm: clamp(5px, 1.2vh, 13px);
      --gap-md: clamp(8px, 1.9vh, 22px);
      --gap-lg: clamp(10px, 2.3vh, 26px);
      --icon-lg: clamp(30px, 5.8vh, 50px);
      --icon-sm: clamp(15px, 2.6vh, 22px);
      --card-art: clamp(40px, 8.2vh, 72px);
      --field-h: clamp(36px, 7.2vh, 64px);
      --button-h: clamp(38px, 6.8vh, 58px);
      --pill-h: clamp(24px, 4.2vh, 37px);
      --fs-amount: clamp(19px, 3.5vh, 30px);
      --fs-title: clamp(15px, 2.6vh, 22px);
      --fs-body: clamp(12px, 1.8vh, 15px);
      --fs-small: clamp(11px, 1.6vh, 13px);
      --fs-button: clamp(14px, 2.3vh, 19px);
      --fs-otp: clamp(16px, 2.8vh, 23px);
    }
    body {
      margin: 0; min-height: 100%;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #e9f0fb;
      color: #111a35;
      -webkit-font-smoothing: antialiased;
    }
    .page {
      min-height: 100vh;
      display: flex; justify-content: center;
      padding: clamp(6px, 1.6vh, 16px);
    }
    .sheet {
      width: 100%; max-width: 510px; margin: auto; background: rgba(255,255,255,.98); border-radius: 18px;
      box-shadow: 0 18px 48px rgba(41,72,126,.15), 0 2px 8px rgba(20,40,80,.05);
      overflow: hidden;
    }
    .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
    }
    .header {
      position: relative; min-height: clamp(66px, 13vh, 116px);
      padding: var(--gap-lg) clamp(18px, 5vw, 28px) var(--gap-md);
      display: flex; align-items: flex-start; justify-content: space-between; overflow: hidden;
    }
    .header::before, .header::after {
      content: ""; position: absolute; pointer-events: none; border-radius: 50%;
    }
    .header::before {
      width: 235px; height: 160px; left: -72px; top: -72px;
      background: radial-gradient(circle at 60% 58%, rgba(209,226,255,.88), rgba(236,244,255,.58) 60%, transparent 61%);
    }
    .header::after {
      width: 190px; height: 120px; left: 84px; top: -58px;
      border: 26px solid rgba(244,248,255,.8);
    }
    .card-art {
      position: relative; z-index: 1; width: var(--card-art); height: var(--card-art); border-radius: 50%;
      display: flex; align-items: center; justify-content: center; background: rgba(223,234,255,.72);
    }
    .card-art svg {
      width: 66%; height: auto;
      transform: rotate(-15deg); filter: drop-shadow(0 7px 8px rgba(31,99,220,.22));
    }
    .checkout-summary { position: relative; z-index: 1; text-align: right; }
    .secure-tag {
      display: inline-flex; align-items: center; gap: 7px; font-size: var(--fs-small); color: #68738a;
    }
    .amount { margin-top: var(--gap-sm); font-size: var(--fs-amount); line-height: 1; font-weight: 750; color: #060d27; letter-spacing: -.03em; }
    .amount-accent { width: 34px; height: 3px; margin: var(--gap-sm) 0 0 auto; border-radius: 3px; background: #b7d2ff; }
    .body { padding: var(--gap-sm) clamp(20px, 7vw, 36px) var(--gap-lg); }
    .section-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: var(--gap-sm); }
    .section-title {
      display: inline-flex; align-items: center; gap: clamp(10px, 2vh, 16px); font-size: var(--fs-title); font-weight: 700; color: #111a35;
    }
    .section-icon {
      width: var(--icon-lg); height: var(--icon-lg); border-radius: 50%; background: #f0f6ff;
      display: inline-flex; align-items: center; justify-content: center; color: #1573f3;
    }
    .section-icon svg { width: 56%; height: auto; }
    .tds-pill {
      display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
      font-size: 12px; font-weight: 600; color: #2373df; background: #edf4ff;
      border-radius: 20px; padding: 8px 12px;
    }
    .instruction {
      padding-left: calc(var(--icon-lg) + clamp(10px, 2vh, 16px)); font-size: var(--fs-body); line-height: 1.5;
      color: #69738b; margin: calc(-1 * var(--gap-md)) 0 var(--gap-md);
    }
    .otp-value {
      position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none;
    }
    .otp-row { display: flex; gap: 8px; margin-bottom: var(--gap-xs); }
    .otp-box {
      width: calc((100% - 40px) / 6); min-width: 0; height: var(--field-h); padding: 0;
      text-align: center; font-size: var(--fs-otp); font-weight: 700; color: #111a35; background: #fff;
      border: 1.5px solid #d8dde7; border-radius: 13px; outline: none;
      transition: border-color .15s ease, box-shadow .15s ease;
    }
    .otp-box:focus { border-color: #0876ee; box-shadow: 0 0 0 3px rgba(8,118,238,.11); }
    .otp-box:disabled { background: #f8f9fb; }
    .otp-hint { color: #68738a; font-size: var(--fs-small); margin: 0 0 var(--gap-md); }
    /* Takes the hint's place, so it carries the same margins. */
    .error { min-height: 0; color: #e5484d; font-size: var(--fs-small); margin: 0 0 var(--gap-md); }
    .error:empty { display: none; }
    .primary {
      width: 100%; height: var(--button-h); margin: 0 0 var(--gap-md); padding: 0 14px; color: #fff;
      border: 0; border-radius: 13px; font-size: var(--fs-button); font-weight: 700; cursor: pointer;
      background: linear-gradient(110deg, #2685f4 0%, #116aef 55%, #1763e8 100%);
      box-shadow: 0 10px 22px rgba(18,105,235,.25);
    }
    .primary:disabled, .link:disabled, .bank-link:disabled { opacity: .62; cursor: not-allowed; }
    .primary:hover:not(:disabled) { filter: brightness(.97); }
    .spinner {
      display: inline-block; width: 15px; height: 15px; margin-right: 7px; vertical-align: -3px;
      border: 2px solid rgba(255,255,255,.4); border-top-color: #fff; border-radius: 50%;
      animation: otp-spin .7s linear infinite;
    }
    @keyframes otp-spin { to { transform: rotate(360deg); } }
    .links { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: var(--gap-md); }
    .link {
      display: inline-flex; align-items: center; gap: 10px;
      background: none; border: 0; padding: 0; cursor: pointer; font-size: var(--fs-body); font-weight: 500;
    }
    .link svg { width: var(--icon-sm); height: auto; }
    #resend { color: #1471e7; font-weight: 600; }
    #cancel { color: #68738a; }
    #resend.cooldown { color: #9a9eb0; cursor: default; opacity: 1; }
    .timer-section { border-top: 1px solid #e7eaf0; padding-top: var(--gap-sm); margin-bottom: var(--gap-md); }
    .timer-copy { display: flex; align-items: center; gap: 12px; margin-bottom: var(--gap-xs); color: #68738a; font-size: var(--fs-small); }
    .timer-copy svg { width: var(--icon-sm); height: auto; }
    .timer-copy strong { color: #173d7c; font-weight: 700; }
    .timer-row { display: flex; align-items: center; gap: 10px; padding-left: calc(var(--icon-sm) + 12px); }
    .timer-track {
      flex: 1; height: 4px; border-radius: 4px; background: #eef0f4; overflow: hidden;
    }
    .timer-bar {
      height: 100%; width: 100%; background: linear-gradient(90deg, #2685f4, #1763e8); border-radius: 4px; transition: width 1s linear;
    }
    .timer-label { font-variant-numeric: tabular-nums; }
    .gateway-card { padding: var(--gap-md) 18px; border-radius: 11px; background: linear-gradient(105deg, #f0f6ff, #f7faff); }
    .bank-link {
      width: 100%; background: none; border: 0; padding: 0; cursor: pointer; color: #1471e7;
      display: flex; align-items: center; gap: 14px; text-align: left;
    }
    .bank-link > svg { width: clamp(19px, 3.3vh, 25px); height: auto; }
    .gateway-copy { display: flex; flex-direction: column; gap: 3px; font-size: var(--fs-body); font-weight: 600; }
    .gateway-copy small { color: #68738a; font-size: var(--fs-small); font-weight: 400; }
    .overlay {
      position: fixed; inset: 0; background: rgba(15, 23, 42, .45);
      display: flex; align-items: center; justify-content: center; z-index: 20; padding: 16px;
    }
    .overlay[hidden] { display: none !important; }
    .modal {
      width: min(400px, 100%); background: #fff; border-radius: 14px; padding: 24px 20px 20px;
      box-shadow: 0 16px 40px rgba(0,0,0,.2); text-align: center;
    }
    .modal h2 { margin: 0 0 8px; font-size: 18px; }
    .modal p { margin: 0 0 20px; color: #475467; font-size: 14px; line-height: 1.45; }
    .modal-actions { display: flex; gap: 12px; }
    .modal-cancel, .modal-confirm {
      flex: 1; height: 46px; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer;
    }
    .modal-cancel { border: 1.5px solid #d0d5dd; background: #fff; color: #344054; }
    .modal-confirm { border: 0; background: #16182b; color: #fff; }
    .modal.abort { width: min(420px, 100%); text-align: left; padding: 20px; }
    .modal.abort .modal-head {
      display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;
    }
    .modal.abort h2 { margin: 0; font-size: 18px; font-weight: 700; }
    .modal-close {
      background: none; border: 0; padding: 0; width: 24px; height: 24px; cursor: pointer; color: #667085;
    }
    .modal.abort p { margin: 0 0 20px; color: #475467; font-size: 15px; }
    .modal.abort .modal-actions { justify-content: flex-end; align-items: center; gap: 20px; }
    .abort-yes {
      background: none; border: 0; color: #d92d20; font-size: 15px; font-weight: 600; cursor: pointer; padding: 0;
    }
    .abort-no {
      min-width: 120px; height: 44px; border: 0; border-radius: 10px; background: #16182b; color: #fff;
      font-size: 15px; font-weight: 700; cursor: pointer; padding: 0 16px;
    }
    .toast {
      position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
      background: #067647; color: #fff; padding: 10px 16px; border-radius: 8px;
      font-size: 13px; font-weight: 600; z-index: 30; white-space: nowrap;
      box-shadow: 0 8px 20px rgba(0,0,0,.15);
    }
    .toast[hidden] { display: none !important; }
    .footer {
      padding: var(--gap-md) clamp(12px, 5vw, 28px); border-top: 1px solid #edf0f5; background: #fff;
      display: flex; flex-direction: column; align-items: center; gap: var(--gap-sm);
    }
    .rzp {
      display: inline-flex; align-items: center; gap: 3px;
      font-size: clamp(14px, 2.6vh, 18px); font-style: italic; font-weight: 800; color: #101c48; letter-spacing: -.04em;
    }
    .rzp img { width: 17px; height: 20px; object-fit: contain; filter: invert(39%) sepia(98%) saturate(2532%) hue-rotate(201deg) brightness(101%); }
    .footer-tagline { margin: 0; color: #68738a; font-size: var(--fs-small); }
    .networks { width: 100%; display: flex; gap: 10px; justify-content: center; }
    .pill {
      min-width: 66px; height: var(--pill-h); padding: 0 10px; display: inline-flex; align-items: center; justify-content: center; gap: 5px;
      font-size: 11px; font-weight: 700; color: #17213e; background: #f4f6fa; border-radius: 7px;
    }
    .brand-logo { display: block; max-width: 45px; max-height: 70%; object-fit: contain; }
    .upi-logo { width: 18px; height: 70%; object-fit: cover; object-position: right; }
    .pci-icon { color: #25a584; }
    svg { display: inline-block; flex-shrink: 0; }
    @media (max-width: 420px) {
      .otp-row { gap: 6px; }
      .otp-box { width: calc((100% - 30px) / 6); border-radius: 10px; }
      .networks { gap: 5px; }
      .pill { min-width: 54px; padding: 0 6px; }
    }
    /* Last resort on very short frames: drop the copy that is purely decorative. */
    @media (max-height: 560px) {
      .footer-tagline, .amount-accent, .gateway-copy small { display: none; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="sheet">
      <div class="header">
        <span class="card-art" aria-hidden="true">
          <!-- Credit-card icon geometry sourced from Lucide (ISC). -->
          <svg width="48" height="36" viewBox="0 0 48 36" fill="none">
            <defs><linearGradient id="card-gradient" x1="3" y1="4" x2="45" y2="32" gradientUnits="userSpaceOnUse"><stop stop-color="#278DF8"/><stop offset="1" stop-color="#1456DB"/></linearGradient></defs>
            <rect x="2" y="4" width="44" height="28" rx="4" fill="url(#card-gradient)"/>
            <path d="M3 12h42" stroke="#8CC4FF" stroke-width="4"/>
            <path d="M8 24h10" stroke="#D9ECFF" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
        </span>
        <div class="checkout-summary">
          <span class="secure-tag">
            <!-- Lock icon sourced from Lucide (ISC). -->
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="16" r="1"/><rect x="3" y="10" width="18" height="12" rx="2"/><path d="M7 10V7a5 5 0 0 1 10 0v3"/></svg>
            Secure checkout
          </span>
          ${
            amountLabel
              ? `<div class="amount" aria-label="${amountLabel}">${displayAmountLabel}</div><div class="amount-accent"></div>`
              : ''
          }
        </div>
      </div>
      <div class="body">
        <div class="section-row">
          <span class="section-title">
            <span class="section-icon" aria-hidden="true">
              <!-- Shield icon sourced from Lucide (ISC). -->
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
            </span>
            Card verification
          </span>
          <span class="tds-pill">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="10" width="18" height="12" rx="2"/><path d="M7 10V7a5 5 0 0 1 10 0v3"/></svg>
            3D Secure
          </span>
        </div>
        <p class="instruction">${subtitle}</p>
        <form id="otp-form">
          <input class="otp-value" id="otp" name="otp" inputmode="numeric" pattern="[0-9]*" maxlength="6" tabindex="-1" aria-hidden="true" />
          <div class="otp-row" id="otp-row" role="group" aria-label="${placeholder}">
            ${[0, 1, 2, 3, 4, 5]
              .map(
                (index) =>
                  `<input class="otp-box" data-otp-index="${index}" inputmode="numeric" pattern="[0-9]*" maxlength="1" autocomplete="${
                    index === 0 ? 'one-time-code' : 'off'
                  }" aria-label="OTP digit ${index + 1}" />`
              )
              .join('')}
          </div>
          <p class="otp-hint">${placeholder === DEFAULT_COPY.placeholder ? 'Enter the 6-digit OTP' : placeholder}</p>
          <div class="error" id="error"></div>
          <button class="primary" id="submit" type="submit">${submitLabel}</button>
        </form>
        <div class="links">
          <button class="link cooldown" id="resend" type="button" disabled>
            <!-- Refresh icon sourced from Lucide (ISC). -->
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15.74-6.26L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.74 6.26L3 16"/><path d="M8 16H3v5"/></svg>
            <span id="resend-text">Resend OTP in 00:30</span>
          </button>
          <button class="link" id="cancel" type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            ${cancelLabel}
          </button>
        </div>
        <div class="timer-section">
          <div class="timer-copy">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>This page will timeout after <strong id="timeout" class="timer-label" aria-label="This page will timeout after ${timeoutStart} minutes">${timeoutStart}</strong> minutes</span>
          </div>
          <div class="timer-row">
            <div class="timer-track"><div class="timer-bar" id="timer-bar"></div></div>
          </div>
        </div>
        ${
          showBankLink
            ? `<div class="gateway-card"><button class="bank-link" id="bank-page" type="button"><svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg><span class="gateway-copy">${completeOnBankLabel}<small>You will be redirected to the bank's secure page.</small></span></button></div>`
            : ''
        }
      </div>
      <div class="footer">
        <span class="rzp"><img src="https://cdn.jsdelivr.net/npm/simple-icons@16.29.0/icons/razorpay.svg" alt="" />Razorpay</span>
        <p class="footer-tagline">Secure. Reliable. Built for your business.</p>
        <div class="networks">
          <span class="pill"><img class="upi-logo" src="https://upload.wikimedia.org/wikipedia/commons/e/e1/UPI-Logo-vector.svg" alt="" />UPI</span>
          <span class="pill"><img class="brand-logo" src="https://cdn.simpleicons.org/visa/1434CB" alt="Visa" /></span>
          <span class="pill"><img class="brand-logo" src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" /></span>
          <span class="pill"><img class="brand-logo" src="https://upload.wikimedia.org/wikipedia/commons/d/d1/RuPay.svg" alt="RuPay" /></span>
          <span class="pill"><svg class="pci-icon" width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 3.5 5.5v5.7c0 5.3 3.6 9.2 8.5 10.8 4.9-1.6 8.5-5.5 8.5-10.8V5.5L12 2Zm-1.1 14-3.2-3.2 1.4-1.4 1.8 1.8 4-4 1.4 1.4-5.4 5.4Z"/></svg>PCI DSS</span>
        </div>
      </div>
    </div>
    <div class="overlay" id="resend-modal" hidden>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="resend-title">
        <h2 id="resend-title">Resend OTP</h2>
        <p id="resend-copy">${
          last4
            ? `OTP will be sent to the phone number linked to your card ending with ${last4}.`
            : 'OTP will be sent to the phone number linked to your card.'
        }</p>
        <div class="modal-actions">
          <button class="modal-cancel" id="resend-no" type="button">Cancel</button>
          <button class="modal-confirm" id="resend-yes" type="button">Resend</button>
        </div>
      </div>
    </div>
    <div class="overlay" id="cancel-modal" hidden>
      <div class="modal abort" role="dialog" aria-modal="true" aria-labelledby="cancel-title">
        <div class="modal-head">
          <h2 id="cancel-title">Cancel Payment</h2>
          <button class="modal-close" id="cancel-close" type="button" aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <p>Are you sure you want to cancel the payment?</p>
        <div class="modal-actions">
          <button class="abort-yes" id="cancel-yes" type="button">Yes, Cancel</button>
          <button class="abort-no" id="cancel-no" type="button">No, don't</button>
        </div>
      </div>
    </div>
    <div class="toast" id="toast" hidden>OTP sent successfully</div>
  </div>
  <script>
    var channelId = ${JSON.stringify(channelId)};
    var remaining = ${Math.floor(timeoutMs / 1000)};
    var totalDuration = remaining;
    var timedOut = false;
    var resendCooldown = 0;
    var resendPending = false;
    var submitting = false;
    var toastTimer = null;
    // Captured before the first render so the idle label survives the spinner swap.
    var submitIdleHtml = document.getElementById('submit').innerHTML;
    function post(payload) {
      parent.postMessage(Object.assign({ source: '${OTP_IFRAME_SOURCE}', channelId: channelId }, payload), '*');
    }
    function setError(message) {
      document.getElementById('error').textContent = message || '';
      // The error says what the hint says, only louder, so only one of them is ever on screen.
      document.querySelector('.otp-hint').hidden = !!message;
    }
    function setFormDisabled(disabled) {
      document.getElementById('otp').disabled = disabled;
      Array.prototype.forEach.call(document.querySelectorAll('.otp-box'), function (box) {
        box.disabled = disabled;
      });
      document.getElementById('cancel').disabled = disabled;
      var bank = document.getElementById('bank-page');
      if (bank) { bank.disabled = disabled; }
      renderSubmitLabel();
      renderResendLabel();
    }
    function renderSubmitLabel() {
      var btn = document.getElementById('submit');
      if (submitting) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner" aria-hidden="true"></span>' + ${JSON.stringify(submittingLabel)};
        return;
      }
      btn.disabled = timedOut;
      btn.innerHTML = submitIdleHtml;
    }
    // The confirm call runs on the host and can take a while, so the whole page goes read only
    // until it comes back. A second submit would burn one of the bank's OTP attempts.
    function setSubmitting(pending) {
      submitting = pending;
      setFormDisabled(pending || timedOut);
    }
    function pad(value) { return (value < 10 ? '0' : '') + value; }
    function formatRemaining(seconds) {
      return pad(Math.floor(seconds / 60)) + ':' + pad(seconds % 60);
    }
    function showToast(message) {
      var toast = document.getElementById('toast');
      toast.textContent = message;
      toast.hidden = false;
      if (toastTimer) { clearTimeout(toastTimer); }
      toastTimer = setTimeout(function () { toast.hidden = true; }, 3000);
    }
    function setResendModal(open) {
      document.getElementById('resend-modal').hidden = !open;
      if (open) { document.getElementById('cancel-modal').hidden = true; }
    }
    function setCancelModal(open) {
      document.getElementById('cancel-modal').hidden = !open;
      if (open) { document.getElementById('resend-modal').hidden = true; }
    }
    function renderResendLabel() {
      var btn = document.getElementById('resend');
      var label = document.getElementById('resend-text');
      if (resendPending) {
        btn.disabled = true;
        btn.classList.remove('cooldown');
        label.textContent = 'Resending...';
        return;
      }
      if (resendCooldown > 0) {
        btn.disabled = true;
        btn.classList.add('cooldown');
        label.textContent = 'Resend OTP in ' + formatRemaining(resendCooldown);
        return;
      }
      btn.disabled = timedOut || submitting;
      btn.classList.remove('cooldown');
      label.textContent = ${JSON.stringify(resendLabel)};
    }
    function startResendCooldown(seconds) {
      resendCooldown = seconds;
      renderResendLabel();
      var tickCooldown = function () {
        if (resendCooldown <= 0) { return; }
        resendCooldown -= 1;
        renderResendLabel();
        if (resendCooldown > 0) { setTimeout(tickCooldown, 1000); }
      };
      setTimeout(tickCooldown, 1000);
    }
    function tick() {
      var timeoutEl = document.getElementById('timeout');
      var timerBar = document.getElementById('timer-bar');
      if (remaining <= 0) {
        timedOut = true;
        submitting = false;
        timeoutEl.textContent = '0:00';
        timeoutEl.setAttribute('aria-label', 'This page has timed out');
        timerBar.style.width = '0%';
        setFormDisabled(true);
        setResendModal(false);
        setCancelModal(false);
        post({ type: 'timeout' });
        return;
      }
      timeoutEl.textContent = Math.floor(remaining / 60) + ':' + pad(remaining % 60);
      timeoutEl.setAttribute('aria-label', 'This page will timeout after ' + formatRemaining(remaining) + ' minutes');
      timerBar.style.width = (remaining / totalDuration * 100) + '%';
      remaining -= 1;
      setTimeout(tick, 1000);
    }
    var otpInput = document.getElementById('otp');
    var otpBoxes = Array.prototype.slice.call(document.querySelectorAll('.otp-box'));
    function syncBoxesFromValue() {
      otpInput.value = (otpInput.value || '').replace(/\\D/g, '').slice(0, 6);
      otpBoxes.forEach(function (box, index) {
        box.value = otpInput.value.charAt(index);
      });
    }
    function syncValueFromBoxes() {
      otpInput.value = otpBoxes.map(function (box) { return box.value; }).join('');
      setError('');
    }
    function submitOtp() {
      if (timedOut || submitting) { return; }
      var otp = (otpInput.value || '').replace(/\\s/g, '');
      if (!/^\\d{6}$/.test(otp)) {
        setError('Enter the full 6-digit OTP');
        return;
      }
      setError('');
      setSubmitting(true);
      post({ type: 'submit', otp: otp });
    }
    // The last digit completes the only input on the page, so it submits without waiting for the
    // button. setSubmitting locks the page, which keeps this from firing twice.
    function autoSubmitWhenComplete() {
      if (/^\\d{6}$/.test(otpInput.value || '')) { submitOtp(); }
    }
    otpInput.addEventListener('input', function () {
      syncBoxesFromValue();
      autoSubmitWhenComplete();
    });
    otpBoxes.forEach(function (box, index) {
      box.addEventListener('input', function () {
        var digits = (box.value || '').replace(/\\D/g, '');
        if (digits.length > 1) {
          digits.slice(0, otpBoxes.length - index).split('').forEach(function (digit, offset) {
            otpBoxes[index + offset].value = digit;
          });
          syncValueFromBoxes();
          otpBoxes[Math.min(index + digits.length, otpBoxes.length) - 1].focus();
          autoSubmitWhenComplete();
          return;
        }
        box.value = digits.charAt(digits.length - 1) || '';
        syncValueFromBoxes();
        if (box.value && index < otpBoxes.length - 1) { otpBoxes[index + 1].focus(); }
        autoSubmitWhenComplete();
      });
      box.addEventListener('keydown', function (event) {
        if (event.key === 'Backspace' && !box.value && index > 0) {
          otpBoxes[index - 1].focus();
        }
        if (event.key === 'ArrowLeft' && index > 0) { otpBoxes[index - 1].focus(); }
        if (event.key === 'ArrowRight' && index < otpBoxes.length - 1) { otpBoxes[index + 1].focus(); }
      });
      box.addEventListener('paste', function (event) {
        event.preventDefault();
        var clipboard = event.clipboardData && event.clipboardData.getData('text');
        otpInput.value = (clipboard || '').replace(/\\D/g, '').slice(0, 6);
        syncBoxesFromValue();
        syncValueFromBoxes();
        otpBoxes[Math.max(0, Math.min(otpInput.value.length, otpBoxes.length) - 1)].focus();
        autoSubmitWhenComplete();
      });
    });
    document.getElementById('otp-form').addEventListener('submit', function (event) {
      event.preventDefault();
      submitOtp();
    });
    document.getElementById('resend').addEventListener('click', function () {
      if (timedOut || submitting || resendPending || resendCooldown > 0) { return; }
      setError('');
      setResendModal(true);
    });
    document.getElementById('resend-no').addEventListener('click', function () {
      setResendModal(false);
    });
    document.getElementById('resend-yes').addEventListener('click', function () {
      if (timedOut || submitting || resendPending) { return; }
      setResendModal(false);
      resendPending = true;
      renderResendLabel();
      post({ type: 'resend' });
    });
    document.getElementById('cancel').addEventListener('click', function () {
      if (timedOut || submitting) { return; }
      setCancelModal(true);
    });
    document.getElementById('cancel-no').addEventListener('click', function () {
      setCancelModal(false);
    });
    document.getElementById('cancel-close').addEventListener('click', function () {
      setCancelModal(false);
    });
    document.getElementById('cancel-yes').addEventListener('click', function () {
      setCancelModal(false);
      post({ type: 'cancel' });
    });
    var bankPage = document.getElementById('bank-page');
    if (bankPage) {
      bankPage.addEventListener('click', function () {
        if (timedOut || submitting) { return; }
        // Navigating from here would open a tab the host cannot watch. The host already holds one
        // from the pay click, so it loads the bank page there and takes over from this point.
        setSubmitting(true);
        post({ type: 'redirect' });
      });
    }
    window.addEventListener('message', function (event) {
      var data = event.data || {};
      if (data.source !== '${OTP_HOST_SOURCE}' || data.channelId !== channelId) { return; }
      if (data.type === 'error') {
        resendPending = false;
        // A rejected OTP is the only way back from the loading state: the host closes the iframe
        // on every other outcome, so re-enable the page for another attempt.
        setSubmitting(false);
        setError(data.message || '');
      }
      if (data.type === 'resend_done') {
        resendPending = false;
        showToast('OTP sent successfully');
        startResendCooldown(${OTP_RESEND_COOLDOWN_SECONDS});
      }
    });
    otpBoxes[0].focus();
    tick();
    startResendCooldown(${OTP_RESEND_COOLDOWN_SECONDS});
  </script>
</body>
</html>`;
}

function formatTimeout(totalSeconds: number): string {
  const seconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  const pad = (value: number) => (value < 10 ? '0' : '') + value;
  return `${pad(minutes)}:${pad(remainder)}`;
}

function safeHttpUrl(url?: string): string {
  if (!url) {
    return '';
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch (e) {
    return '';
  }
  return '';
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
