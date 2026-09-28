import Ids from '@/constants/ids';
import Helpers from '@/helpers/index';
import {PopupConsentOverlayOptions} from '@/interfaces/cb-instance-options';

type OverlayCopy = Required<Pick<PopupConsentOverlayOptions, 'title' | 'description' | 'buttonLabel' | 'closeLabel'>>;
type OverlayConfig = OverlayCopy & PopupConsentOverlayOptions;

const DEFAULT_COPY: OverlayCopy = {
  title: 'Payment opens in a new tab',
  description: "Complete your payment there. This page will update automatically once it's done",
  buttonLabel: 'Continue to payment',
  closeLabel: 'Close',
};

const BASE_STYLE = `
#${Ids.CB_POPUP_CONSENT} {
  position: fixed !important;
  left: 0 !important;
  right: 0 !important;
  top: 0 !important;
  bottom: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  background: rgba(0, 0, 0, 0.5) !important;
  z-index: 2147483647 !important;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
}

#${Ids.CB_POPUP_CONSENT} .cb-popup-consent-card {
  box-sizing: border-box !important;
  position: relative !important;
  width: 360px !important;
  max-width: calc(100% - 32px) !important;
  padding: 24px !important;
  border-radius: 8px !important;
  background: #fff !important;
  box-shadow: 0px 10px 20px rgba(0, 0, 0, 0.25) !important;
  text-align: center !important;
}

#${Ids.CB_POPUP_CONSENT} .cb-popup-consent-title {
  margin: 0 0 8px !important;
  /* keeps a wrapping title clear of the close button */
  padding: 0 24px !important;
  font-size: 18px !important;
  line-height: 24px !important;
  font-weight: 600 !important;
  color: #12344d !important;
}

#${Ids.CB_POPUP_CONSENT} .cb-popup-consent-description {
  margin: 0 0 20px !important;
  font-size: 14px !important;
  line-height: 20px !important;
  color: #5c7080 !important;
}

#${Ids.CB_POPUP_CONSENT} .cb-popup-consent-continue {
  display: block !important;
  box-sizing: border-box !important;
  width: 100% !important;
  padding: 12px 16px !important;
  border: 0 !important;
  border-radius: 4px !important;
  font-size: 15px !important;
  font-weight: 600 !important;
  cursor: pointer !important;
  background: #12344d !important;
  color: #fff !important;
}

#${Ids.CB_POPUP_CONSENT} .cb-popup-consent-close {
  position: absolute !important;
  top: 8px !important;
  right: 8px !important;
  box-sizing: border-box !important;
  width: 32px !important;
  height: 32px !important;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 4px !important;
  background: transparent !important;
  color: #5c7080 !important;
  font-size: 22px !important;
  line-height: 1 !important;
  cursor: pointer !important;
}
`;

/**
 * Browsers only allow `window.open` while a user gesture is still active. When the gesture
 * has expired, this overlay collects a fresh click so the window can be opened from it.
 *
 * The continue handler is invoked synchronously from inside the click listener. Anything
 * that defers it — `await`, `setTimeout`, a promise callback — hands back a window the
 * browser will block again.
 */
export default class PopupConsentOverlay {
  private static active: PopupConsentOverlay;

  private wrapperEl: HTMLDivElement;
  private styleEl: HTMLStyleElement;
  private keyListener: (event: KeyboardEvent) => void;
  private rejectPrompt: (reason?: any) => void;
  private settled: boolean = false;

  static isSupported(): boolean {
    return typeof document !== 'undefined' && !!document.body;
  }

  static destroyActive(): void {
    if (PopupConsentOverlay.active) PopupConsentOverlay.active.destroy();
  }

  prompt(onContinue: () => void, options?: PopupConsentOverlayOptions): Promise<void> {
    const config: OverlayConfig = Object.assign({}, DEFAULT_COPY, options || {});
    return new Promise<void>((resolve, reject) => {
      this.render(config);
      this.rejectPrompt = reject;

      const continueEl = <HTMLButtonElement>this.wrapperEl.querySelector('.cb-popup-consent-continue');
      const closeEl = <HTMLButtonElement>this.wrapperEl.querySelector('.cb-popup-consent-close');

      continueEl.addEventListener('click', () => {
        if (this.settled) return;
        this.settled = true;
        try {
          onContinue();
        } catch (err) {
          this.destroy();
          reject(err);
          return;
        }
        this.destroy();
        resolve();
      });

      const dismiss = () => {
        if (this.settled) return;
        this.settled = true;
        this.destroy();
        reject();
      };

      closeEl.addEventListener('click', dismiss);
      this.keyListener = (event: KeyboardEvent) => {
        if (event.key === 'Escape' || event.key === 'Esc') dismiss();
      };
      document.addEventListener('keydown', this.keyListener);

      try {
        continueEl.focus();
      } catch (e) {
        // focus is best effort
      }
    });
  }

  private render(config: OverlayConfig): void {
    PopupConsentOverlay.destroyActive();
    this.destroy();
    PopupConsentOverlay.active = this;

    this.styleEl = document.createElement('style');
    this.styleEl.setAttribute('type', 'text/css');
    const nonce = PopupConsentOverlay.getCspNonce();
    if (nonce) this.styleEl.setAttribute('nonce', nonce);
    this.styleEl.appendChild(document.createTextNode(BASE_STYLE));
    document.head.appendChild(this.styleEl);

    this.wrapperEl = document.createElement('div');
    this.wrapperEl.setAttribute('id', Ids.CB_POPUP_CONSENT);
    this.wrapperEl.setAttribute('role', 'dialog');
    this.wrapperEl.setAttribute('aria-modal', 'true');

    const card = document.createElement('div');
    card.className = 'cb-popup-consent-card';
    card.appendChild(this.createTextEl('h2', 'cb-popup-consent-title', config.title));
    card.appendChild(this.createTextEl('p', 'cb-popup-consent-description', config.description));

    const continueEl = this.createButtonEl('cb-popup-consent-continue', config.buttonLabel);
    this.applyButtonColors(continueEl, config);
    card.appendChild(continueEl);

    // '\u00d7' is the visible glyph, so the button carries an aria-label for its name.
    card.appendChild(this.createButtonEl('cb-popup-consent-close', '\u00d7', config.closeLabel));

    this.wrapperEl.appendChild(card);
    document.body.appendChild(this.wrapperEl);
  }

  private createTextEl(tag: string, className: string, text: string): HTMLElement {
    const el = document.createElement(tag);
    el.className = className;
    el.textContent = text;
    return el;
  }

  /**
   * Merchant colours are set on the element rather than interpolated into the stylesheet.
   * The CSSOM setter validates the value, so a malformed one is dropped and the default rule
   * still wins — and nothing merchant-supplied can break out into arbitrary CSS. The default
   * rule is `!important`, so these have to be too.
   */
  private applyButtonColors(el: HTMLButtonElement, config: PopupConsentOverlayOptions): void {
    if (config.buttonColor) el.style.setProperty('background', config.buttonColor, 'important');
    if (config.buttonTextColor) el.style.setProperty('color', config.buttonTextColor, 'important');
  }

  private createButtonEl(className: string, label: string, ariaLabel?: string): HTMLButtonElement {
    const el = document.createElement('button');
    el.setAttribute('type', 'button');
    if (ariaLabel) el.setAttribute('aria-label', ariaLabel);
    el.className = className;
    el.textContent = label;
    return el;
  }

  destroy(): void {
    if (this.keyListener) {
      document.removeEventListener('keydown', this.keyListener);
      this.keyListener = null;
    }
    if (this.wrapperEl) {
      this.wrapperEl.remove();
      this.wrapperEl = null;
    }
    if (this.styleEl) {
      this.styleEl.remove();
      this.styleEl = null;
    }
    if (PopupConsentOverlay.active === this) PopupConsentOverlay.active = null;
    // Tearing down an overlay the customer never answered leaves the caller waiting forever,
    // so it is treated the same as a dismissal.
    if (!this.settled && this.rejectPrompt) {
      this.settled = true;
      const reject = this.rejectPrompt;
      this.rejectPrompt = null;
      reject();
    }
  }

  private static getCspNonce(): string {
    let nonce = window._hp_csp_nonce;
    const cbInstance = Helpers.getCbInstance();
    if (cbInstance && cbInstance.options) {
      nonce = nonce || cbInstance.options.cspNonce;
    }
    return nonce;
  }
}
