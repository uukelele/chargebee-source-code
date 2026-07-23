import LightBox from '@/internal/auth-redirect/lightbox';
import Helpers from '@/helpers';
import CbWindowManager from '@/models/cb-window-manager';

export default class RedirectHandler {
  iframeContainer: HTMLDivElement;
  lightbox: LightBox;
  isIframeOpen: boolean = false;
  windowManager: CbWindowManager;
  isRedirectMode: boolean = false;
  isIframeMode: boolean = false;

  createIframe(gateway: string): HTMLIFrameElement {
    this.lightbox = new LightBox(gateway);

    this.lightbox.createIframe(`cb-3ds-iframe-${Helpers.genUuid()}`);
    return this.lightbox.getIframe();
  }

  protected hideIframeLoader() {
    this.lightbox && this.lightbox.hideLoader();
  }

  openIframe() {
    if (this.lightbox) {
      this.lightbox.open();
      this.isIframeOpen = true;
    }
  }

  removeIframe() {
    if (this.lightbox) {
      this.lightbox.close();
      this.lightbox.destroy();
      this.isIframeOpen = false;
    }
  }

  setWindowManager(windowManager: CbWindowManager) {
    this.windowManager = windowManager;
  }

  getWindowManager(): CbWindowManager {
    return this.windowManager;
  }

  closeTab() {
    if (this.windowManager) {
      this.windowManager.close();
    }
    this.removeIframe();
  }

  setRedirectMode(val: boolean) {
    this.isRedirectMode = val;
  }

  setIframeMode(val: boolean) {
    this.isIframeMode = val;
  }
}
