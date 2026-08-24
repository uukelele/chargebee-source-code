/**
 * Shared HTML builder for QR-based payment lightboxes (Payconiq, WeChat, Cash App, etc.).
 * Callers pass copy / QR / timer; layout (instruction, progress bar, waiting message) is shared.
 */

import LightBox from '@/internal/auth-redirect/lightbox';

export type QrPaymentModalOptions = {
  /** Image URL or data-URI for the QR code */
  qrCode: string;
  qrAlt?: string;
  heading: string;
  /** Shown under the heading — how to complete payment */
  instruction?: string;
  /**
   * Timer label with `{time}` placeholder, e.g. "Approve payment within: {time}"
   * or "This QR code is valid for {time}".
   */
  timerLabel: string;
  timerDurationSeconds: number;
  /** Shown under the timer while we poll for authorization */
  waitingMessage?: string;
  /**
   * Accent for the progress bar and timer value.
   * Hex only (e.g. `#01264B`). Defaults to Chargebee checkout primary blue.
   */
  accentColor?: string;
  /**
   * Optional HTML above the QR (e.g. mobile deep-link button + divider).
   * Inserted as-is (not escaped) — callers must only pass trusted markup
   * built via helpers like `buildQrOpenAppButtonHtml` / `buildQrOrDividerHtml`,
   * never raw merchant- or user-supplied strings.
   */
  headerHtml?: string;
  /**
   * Standard in-card × (web + mobile). Defaults to true.
   * Click posts dismiss `{source, action}` to the parent window.
   */
  showCloseButton?: boolean;
};

/** postMessage payload when the in-card QR × is clicked. */
export const QR_MODAL_MESSAGE_SOURCE = 'cb-qr-payment-modal';
export const QR_MODAL_DISMISS_ACTION = 'dismiss';

export function isQrModalDismissMessage(data: any): boolean {
  return !!(data && data.source === QR_MODAL_MESSAGE_SOURCE && data.action === QR_MODAL_DISMISS_ACTION);
}

export type QrPaymentModalOpenHandlers = {
  /** Called once after the QR frame is dismissed (in-card ×). */
  onDismiss?: () => void;
};

/**
 * QR challenge lightbox for payment methods (Payconiq, WeChat, Cash App, …).
 * Owns iframe show/write, content-height fit, in-card × dismiss, and cleanup wiring.
 * Payment handlers pass copy + QR (+ optional headerHtml) and an onDismiss callback.
 */
export class QrPaymentModal extends LightBox {
  private frameName: string;
  private messageListener: (event: MessageEvent) => void;

  constructor(namespace: string, frameName?: string) {
    super(namespace);
    this.frameName = frameName || `${namespace}-qr-frame`;
    this.messageListener = (event: MessageEvent) => this.onQrModalMessage(event);
  }

  /**
   * Show the shared QR modal. Does not force iframe width (desktop 400 / mobile 100%).
   * Named openQr so it does not conflict with LightBox.open() (3DS URL/form flow).
   */
  openQr(options: QrPaymentModalOptions, handlers: QrPaymentModalOpenHandlers = {}): void {
    const iframe = this.createIframe(this.frameName);
    this.show();
    this.enableDismiss(() => {
      this.unbindDismissMessage();
      if (handlers.onDismiss) {
        handlers.onDismiss();
      }
    });
    this.bindDismissMessage();

    iframe.onload = () => {
      const doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
      if (doc && options.qrCode) {
        doc.open();
        doc.write(buildQrPaymentModalHtml(options));
        doc.close();
      }
      fitQrLightboxFrameToContent(iframe).then(() => {
        if (this.hasBeenDismissed()) {
          return;
        }
        this.hideLoader();
      });
    };
    iframe.src = 'about:blank';
  }

  private bindDismissMessage() {
    window.addEventListener('message', this.messageListener);
  }

  private unbindDismissMessage() {
    window.removeEventListener('message', this.messageListener);
  }

  private onQrModalMessage(event: MessageEvent) {
    if (!isQrModalDismissMessage(event.data)) {
      return;
    }
    const iframe = this.getIframe();
    if (iframe && iframe.contentWindow && event.source !== iframe.contentWindow) {
      return;
    }
    if (!this.hasBeenDismissed()) {
      this.dismiss();
    }
  }
}

const DEFAULT_INSTRUCTION = 'Scan the QR code using a supported payment app and complete the payment.';
const DEFAULT_WAITING_MESSAGE = 'Please keep this page open while we verify your payment.';
/** Matches Hosted Pages theme primary (bright azure), not navy chrome. */
const DEFAULT_ACCENT_COLOR = '#2196F3';
const HEX_COLOR_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

/** Desktop LightBox BASE_STYLE width — never force via !important (breaks mobile 100% width). */
export const QR_LIGHTBOX_DESKTOP_WIDTH = 400;

export type QrLightboxFrameSize = {
  /**
   * Avoid for QR flows: `width` with !important overrides LightBox mobile `width: 100%`.
   * Prefer leaving width to BASE_STYLE.
   */
  width?: number;
  height?: number;
};

export type FitQrLightboxFrameOptions = {
  /** Lower bound for measured height (avoids a collapsed frame while loading). */
  minHeight?: number;
  /** Upper bound; defaults to ~90% of the viewport. */
  maxHeight?: number;
};

/**
 * Override LightBox iframe dimensions without changing lightbox.ts.
 * Must use setProperty(..., 'important') — plain style assignments lose to BASE_STYLE.
 * For QR flows, pass **height only** so mobile keeps stylesheet `width: 100%`.
 */
export function applyQrLightboxFrameSize(iframe: HTMLIFrameElement, size: QrLightboxFrameSize): void {
  if (size.width != null) {
    const widthPx = `${Math.max(1, size.width | 0)}px`;
    iframe.style.setProperty('width', widthPx, 'important');
    iframe.style.setProperty('min-width', widthPx, 'important');
    iframe.style.setProperty('max-width', widthPx, 'important');
  }
  if (size.height != null) {
    const heightPx = `${Math.max(1, size.height | 0)}px`;
    iframe.style.setProperty('height', heightPx, 'important');
    iframe.style.setProperty('min-height', heightPx, 'important');
    iframe.style.setProperty('max-height', heightPx, 'important');
  }
}

/**
 * Size the QR iframe **height** to its document content (after images load).
 * Does not touch width — LightBox BASE_STYLE keeps 400px desktop / 100% mobile.
 * Returns the applied height in px.
 */
export function fitQrLightboxFrameToContent(
  iframe: HTMLIFrameElement,
  options: FitQrLightboxFrameOptions = {}
): Promise<number> {
  const doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
  if (!doc || !doc.body) {
    return Promise.resolve(0);
  }

  return waitForDocumentImages(doc).then(() => {
    // Collapse height first so measurement is not inflated by the default 600px frame.
    applyQrLightboxFrameSize(iframe, {height: 1});
    const measured = measureQrDocumentHeight(doc);
    const minHeight = Math.max(0, options.minHeight != null ? options.minHeight : 0);
    const maxHeight =
      options.maxHeight != null ? Math.max(minHeight, options.maxHeight) : defaultMaxFrameHeight(minHeight);
    const contentHeight = Number.isFinite(measured) && measured > 0 ? measured : minHeight;
    const height = Math.max(minHeight, Math.min(maxHeight, contentHeight));
    if (height > 0) {
      applyQrLightboxFrameSize(iframe, {height});
    }
    return height;
  });
}

function defaultMaxFrameHeight(minHeight: number): number {
  const viewportHeight =
    typeof window !== 'undefined' && typeof window.innerHeight === 'number' && window.innerHeight > 0
      ? window.innerHeight
      : 800;
  return Math.max(minHeight, Math.floor(viewportHeight * 0.9));
}

function waitForDocumentImages(doc: Document, timeoutMs: number = 2000): Promise<void> {
  const images = doc.images ? Array.prototype.slice.call(doc.images) : [];
  if (!images.length) {
    return Promise.resolve();
  }
  const pending = Promise.all(
    images.map((img: HTMLImageElement) => {
      if (img.complete) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        const done = () => resolve();
        img.addEventListener('load', done, {once: true} as any);
        img.addEventListener('error', done, {once: true} as any);
      });
    })
  ).then(() => undefined);

  return Promise.race([
    pending,
    new Promise<void>((resolve) => {
      setTimeout(resolve, timeoutMs);
    }),
  ]);
}

function measureQrDocumentHeight(doc: Document): number {
  // Prefer the content shell — documentElement.scrollHeight inside an iframe
  // often equals the iframe viewport (e.g. LightBox 600px), not the content.
  const shell = doc.getElementById('qr-shell');
  if (shell) {
    const rect = shell.getBoundingClientRect && shell.getBoundingClientRect();
    const height = Math.ceil(Math.max((rect && rect.height) || 0, shell.offsetHeight || 0, shell.scrollHeight || 0));
    return Number.isFinite(height) ? height : 0;
  }

  const body = doc.body;
  const previousBodyHeight = body.style.height;
  body.style.height = 'auto';
  const height = Math.ceil(Math.max(body.offsetHeight || 0, body.scrollHeight || 0));
  body.style.height = previousBodyHeight;
  return Number.isFinite(height) ? height : 0;
}

/**
 * Builds a self-contained HTML document for an iframe lightbox QR challenge.
 */
export function buildQrPaymentModalHtml(options: QrPaymentModalOptions): string {
  const {
    qrCode,
    qrAlt = 'Payment QR Code',
    heading,
    instruction = DEFAULT_INSTRUCTION,
    timerLabel,
    timerDurationSeconds,
    waitingMessage = DEFAULT_WAITING_MESSAGE,
    accentColor: accentColorOption,
    headerHtml = '',
    showCloseButton = true,
  } = options;

  const accentColor = sanitizeAccentColor(accentColorOption);
  const labelWithTimer = formatTimerLabel(timerLabel);
  const closeButtonHtml = showCloseButton
    ? `<button type="button" id="qr-modal-close" class="qr-modal-close" aria-label="Close">&times;</button>`
    : '';
  const shellClass = showCloseButton ? 'qr-shell qr-shell--closable' : 'qr-shell';
  const closeStyles = showCloseButton
    ? `
  .qr-shell--closable {
    padding-top: 48px;
  }
  .qr-modal-close {
    position: absolute;
    top: 4px;
    right: 4px;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: #6b7280;
    font-size: 28px;
    font-weight: 400;
    line-height: 1;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  .qr-modal-close:hover,
  .qr-modal-close:focus {
    color: #111827;
    outline: none;
  }`
    : '';
  const closeScript = showCloseButton
    ? `
      var closeBtn = document.getElementById('qr-modal-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', function () {
          try {
            window.parent.postMessage({
              source: '${QR_MODAL_MESSAGE_SOURCE}',
              action: '${QR_MODAL_DISMISS_ACTION}'
            }, '*');
          } catch (e) {}
        });
      }`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    height: 100%;
    background: #fff;
  }
  body {
    /* Restore pre-fit behavior: when content exceeds the capped frame, allow scroll. */
    overflow-x: hidden;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  #qr-shell, .qr-shell {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 24px 24px 28px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    color: #21262C;
    gap: 20px;
    background: #fff;
    box-sizing: border-box;
    width: 100%;
    min-height: min-content;
  }
  ${closeStyles}
  .qr-primary {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    gap: 0;
  }
  .qr-image {
    display: block;
    max-width: 200px;
    width: 100%;
    height: auto;
    margin: 0 0 4px;
  }
  .qr-copy {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    gap: 6px;
  }
  .qr-heading {
    font-size: 18px;
    font-weight: 600;
    color: #1a2b4a;
    text-align: center;
    margin: 0;
  }
  .qr-instruction {
    font-size: 13px;
    line-height: 1.45;
    color: #4b5563;
    text-align: center;
    margin: 0;
    max-width: 300px;
  }
  .qr-validity {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    gap: 16px;
  }
  .qr-validity-timer {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    gap: 6px;
  }
  .qr-progress-track {
    width: 100%;
    max-width: 280px;
    height: 6px;
    border-radius: 999px;
    background: #e5e7eb;
    overflow: hidden;
  }
  .qr-progress-bar {
    height: 100%;
    width: 100%;
    border-radius: 999px;
    background: ${accentColor};
    transform-origin: left center;
  }
  .qr-timer {
    font-size: 13px;
    color: #4b5563;
    text-align: center;
    margin: 0;
  }
  .qr-timer #qr-timer-value {
    color: ${accentColor};
    font-weight: 600;
  }
  .qr-waiting {
    font-size: 12px;
    line-height: 1.45;
    color: #4b5563;
    text-align: center;
    margin: 0;
    max-width: 300px;
  }
  .qr-open-app-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 220px;
    max-width: 90%;
    min-height: 44px;
    margin: 4px 0;
    padding: 12px 24px;
    background: #01264B;
    color: #fff;
    font-size: 16px;
    border-radius: 8px;
    text-decoration: none;
    text-align: center;
    box-sizing: border-box;
    white-space: normal;
    word-break: break-word;
  }
  .qr-open-app-loader {
    display: none;
    align-items: center;
    justify-content: center;
  }
  .qr-open-app-loader img {
    width: 20px;
    height: 20px;
  }
  .qr-or-divider {
    display: flex;
    align-items: center;
    width: 100%;
    margin: 4px 0;
  }
  .qr-or-divider__line {
    flex: 1;
    height: 1px;
    background: #E0E0E0;
  }
  .qr-or-divider__label {
    margin: 0 12px;
    color: #888;
    font-size: 14px;
  }
</style>
</head>
<body>
  <div id="qr-shell" class="${shellClass}">
  ${closeButtonHtml}
  ${headerHtml}
  <div class="qr-primary">
    <img class="qr-image" src="${escapeHtmlAttr(qrCode)}" alt="${escapeHtmlAttr(qrAlt)}"/>
    <div class="qr-copy">
      <h1 class="qr-heading">${escapeHtml(heading)}</h1>
      <p class="qr-instruction">${escapeHtml(instruction)}</p>
    </div>
  </div>
  <div class="qr-validity">
    <div class="qr-validity-timer">
      <div class="qr-progress-track" aria-hidden="true">
        <div id="qr-progress-bar" class="qr-progress-bar"></div>
      </div>
      <p class="qr-timer">${labelWithTimer}</p>
    </div>
    <p class="qr-waiting">${escapeHtml(waitingMessage)}</p>
  </div>
  </div>
  <script>
    (function () {
      var duration = ${Math.max(1, timerDurationSeconds | 0)};
      var remaining = duration;
      var display = document.getElementById('qr-timer-value');
      var bar = document.getElementById('qr-progress-bar');
      function pad(n) { return n < 10 ? '0' + n : '' + n; }
      function render() {
        var minutes = Math.floor(remaining / 60);
        var seconds = remaining % 60;
        if (display) display.textContent = pad(minutes) + ':' + pad(seconds);
        if (bar) bar.style.width = Math.max(0, (remaining / duration) * 100) + '%';
      }
      render();
      var interval = setInterval(function () {
        remaining -= 1;
        if (remaining <= 0) {
          remaining = 0;
          render();
          clearInterval(interval);
          return;
        }
        render();
      }, 1000);
${closeScript}
      var openAppBtn = document.getElementById('qr-open-app-btn');
      if (openAppBtn) {
        var openAppLabel = document.getElementById('qr-open-app-label');
        var openAppLoader = document.getElementById('qr-open-app-loader');
        function showOpenAppLoader() {
          if (openAppLabel) openAppLabel.style.display = 'none';
          if (openAppLoader) openAppLoader.style.display = 'inline-flex';
        }
        function resetOpenAppLoader() {
          if (openAppLabel) openAppLabel.style.display = '';
          if (openAppLoader) openAppLoader.style.display = 'none';
        }
        openAppBtn.addEventListener('click', showOpenAppLoader);
        // User may return from the payment app without completing payment;
        // restore the button label when the page becomes visible again.
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'visible') resetOpenAppLoader();
        });
        window.addEventListener('pageshow', resetOpenAppLoader);
      }
    })();
  </script>
</body>
</html>`;
}

export const QrPaymentModalDefaults = {
  instruction: DEFAULT_INSTRUCTION,
  waitingMessage: DEFAULT_WAITING_MESSAGE,
  accentColor: DEFAULT_ACCENT_COLOR,
};

function sanitizeAccentColor(value?: string): string {
  if (value && HEX_COLOR_RE.test(value)) {
    return value;
  }
  return DEFAULT_ACCENT_COLOR;
}

const OPEN_APP_SPINNER_URL =
  'https://d2jxbtsa1l6d79.cloudfront.net/static/app-static-assets/cdn-app-6.1.0_v4/images/button/cn-spinner-white.svg';

/**
 * Mobile deep-link button used above QR (Payconiq / WeChat / etc.).
 * Shows a spinner on click while the payment app opens.
 */
export function buildQrOpenAppButtonHtml(options: {url: string; label: string}): string {
  if (!options.url) {
    return '';
  }
  return `<a id="qr-open-app-btn" class="qr-open-app-btn" href="${escapeHtmlAttr(
    options.url
  )}" target="_blank" rel="noopener">
  <span id="qr-open-app-label">${escapeHtml(options.label)}</span>
  <span id="qr-open-app-loader" class="qr-open-app-loader" aria-hidden="true">
    <img src="${OPEN_APP_SPINNER_URL}" alt="loading"/>
  </span>
</a>`;
}

export function buildQrOrDividerHtml(label: string = 'or'): string {
  return `<div class="qr-or-divider">
  <div class="qr-or-divider__line"></div>
  <span class="qr-or-divider__label">${escapeHtml(label)}</span>
  <div class="qr-or-divider__line"></div>
</div>`;
}

function formatTimerLabel(timerLabel: string): string {
  if (timerLabel.indexOf('{time}') >= 0) {
    const parts = timerLabel.split('{time}');
    return `${escapeHtml(parts[0])}<span id="qr-timer-value"></span>${escapeHtml(parts[1] || '')}`;
  }
  return `${escapeHtml(timerLabel)} <span id="qr-timer-value"></span>`;
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeHtmlAttr(value: string): string {
  return escapeHtml(value);
}

/**
 * Configuration for renderQrPaymentModal — the payment-method-specific parameters
 * that differ across handlers (WeChat Pay, Payconiq, etc.).
 */
export type QrRenderConfig = {
  /** Unique namespace for the LightBox iframe (e.g. 'wechat-pay', 'payconiq-by-bancontact'). */
  modalId: string;
  /** Data-URI or URL of the QR code image. */
  qrCode: string;
  /** Alt text for the QR code image (e.g. 'WeChat Pay QR Code'). */
  qrAlt: string;
  /** Deep-link URL for the mobile open-app button; omit or pass undefined to hide the button. */
  mobileAppUrl?: string;
  /** Resolved render options from the payment method handler. */
  renderOptions: {
    heading: string;
    instruction?: string;
    timerLabel: string;
    timerDurationSeconds: number;
    waitingMessage?: string;
    accentColor?: string;
    buttonText?: string;
  };
  /** Result of Helpers.isMobileOrTablet() — caller supplies this to avoid a circular import. */
  isMobile: boolean;
  /** Called when the user dismisses the QR modal (e.g. to call abandonPendingAuthorization). */
  onDismiss: () => void;
};

/**
 * Creates and opens a QrPaymentModal with the given payment-method configuration.
 * Shared across QR-based handlers (WeChat Pay, Payconiq, …) to avoid duplicating
 * the modal-construction and headerHtml-building boilerplate in each handler.
 *
 * Returns the modal so the caller can assign it to `this.lightbox`.
 */
export function renderQrPaymentModal(config: QrRenderConfig): QrPaymentModal {
  const {modalId, qrCode, qrAlt, mobileAppUrl, renderOptions, isMobile, onDismiss} = config;
  const headerHtml = isMobile
    ? `${buildQrOpenAppButtonHtml({url: mobileAppUrl, label: renderOptions.buttonText})}${buildQrOrDividerHtml()}`
    : '';
  const modal = new QrPaymentModal(modalId);
  modal.openQr(
    {
      qrCode,
      qrAlt,
      heading: renderOptions.heading,
      instruction: renderOptions.instruction,
      timerLabel: renderOptions.timerLabel,
      timerDurationSeconds: renderOptions.timerDurationSeconds,
      waitingMessage: renderOptions.waitingMessage,
      accentColor: renderOptions.accentColor,
      headerHtml,
    },
    {onDismiss}
  );
  return modal;
}
