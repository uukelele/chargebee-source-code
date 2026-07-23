const BASE_STYLE = `
div[id^='cb-frame-wrapper-'] {
  display: none;
  opacity:0;
  position: fixed !important;
  left: 0 !important;
  right: 0 !important;
  top: 0 !important;
  bottom: 0 !important;
  background: rgba(0, 0, 0, 0.5) !important;
  transition: opacity 0.2s;
  z-index: 99999 !important;
}

div[id^='cb-hidden-frame-wrapper-'] {
  display: none;
}

div[id^='cb-frame-wrapper-'] > iframe, div[id^='cb-frame-wrapper-'] > .frame-contents {
  position: absolute !important;
  left: 50% !important;
  top: 50% !important;
  transform: translate(-50%, -50%) !important;
  width: 400px !important;
  height: 600px !important;
  border: 0 !important;
  box-shadow: 0px 10px 20px rgba(0,0,0,0.25) !important;
  background: #fff !important;
  background-image: url(https://d2jxbtsa1l6d79.cloudfront.net/static/app-static-assets/cdn-app-6.1.0_v4/images/button/cn-spinner-black.svg) !important;
  background-repeat: no-repeat !important;
  background-position: center !important;
  z-index: 99999 !important;
}

div[id^='cb-frame-wrapper-'] > iframe.no-spinner, div[id^='cb-frame-wrapper-'] > .frame-contents.no-spinner {
  background-image: none !important;
}

@media (max-width: 400px) {
  div[id^='cb-frame-wrapper-'] > iframe, div[id^='cb-frame-wrapper-'] > .frame-contents {
    width: 100% !important;
    height: 100% !important;
  }
}
`;

enum LightBoxType {
  'NONE',
  'URL',
  'XHTML',
  'FORM_INPUT',
}

export default class LightBox {
  private namespace: string;
  private wrapperEl: HTMLDivElement;
  private hiddenEl: HTMLDivElement;
  private styleEl: HTMLStyleElement;
  private iframe: HTMLIFrameElement;

  private wrapperElId: string;
  private hiddenElId: string;

  private task: Promise<any>;

  private isOpened: boolean = false;

  private url: string;
  private formXHTML: string;
  private formInputFields: any;
  private type: LightBoxType = LightBoxType.NONE;

  constructor(namespace) {
    this.task = Promise.resolve();
    this.namespace = namespace;
    this.wrapperElId = `cb-frame-wrapper-${this.namespace}`;
    this.hiddenElId = `cb-hidden-frame-wrapper-${this.namespace}`;
    this.createWrapperElements();
  }

  private createWrapperElements() {
    if (document.getElementById(this.wrapperElId)) {
      document.getElementById(this.wrapperElId).remove();
    }
    if (document.getElementById(this.hiddenElId)) {
      document.getElementById(this.hiddenElId).remove();
    }
    this.wrapperEl = this.createDivEl(this.wrapperElId);
    this.hiddenEl = this.createDivEl(this.hiddenElId);
    this.createStyle();
  }

  private createDivEl(id: string): HTMLDivElement {
    let divEl = document.createElement('div');
    divEl.setAttribute('id', id);
    document.body.appendChild(divEl);
    return divEl;
  }

  private createStyle() {
    this.styleEl = document.createElement('style');
    this.styleEl.setAttribute('type', 'text/css');
    this.styleEl.appendChild(document.createTextNode(BASE_STYLE));
    document.head.appendChild(this.styleEl);
  }

  private createIFrameInWrapper(key, value): HTMLIFrameElement {
    let frameEl = document.createElement('iframe');
    frameEl.setAttribute(key, value);
    this.wrapperEl.appendChild(frameEl);
    this.iframe = frameEl;
    return frameEl;
  }

  getIframe() {
    return this.iframe;
  }

  setIframe(iframe: HTMLIFrameElement) {
    this.iframe = iframe;
    this.wrapperEl.appendChild(iframe);
  }

  createIframe(name: string) {
    return this.createIFrameInWrapper('name', name);
  }

  private createFormInHidden(): HTMLFormElement {
    this.createIFrameInWrapper('name', this.wrapperElId);
    let formEl = document.createElement('form');
    formEl.setAttribute('target', this.wrapperElId);
    this.hiddenEl.appendChild(formEl);
    return formEl;
  }

  private insertFormInHidden(): HTMLFormElement {
    this.createIFrameInWrapper('name', this.wrapperElId);
    this.hiddenEl.innerHTML = this.formXHTML;
    let formEl = <HTMLFormElement>this.hiddenEl.firstElementChild;
    formEl.setAttribute('target', this.wrapperElId);
    return formEl;
  }

  getWrapperElId(): string {
    return this.wrapperElId;
  }

  getWrapperEl(): HTMLDivElement {
    return this.wrapperEl;
  }

  getHiddenElId(): string {
    return this.hiddenElId;
  }

  setURL(url) {
    this.url = url;
    this.type = LightBoxType.URL;
  }

  setFormXHTML(formXHTML) {
    this.formXHTML = formXHTML;
    this.type = LightBoxType.XHTML;
  }

  setFormInputField(inputFields) {
    this.formInputFields = inputFields;
    this.type = LightBoxType.FORM_INPUT;
  }

  open() {
    this.task.then(() => {
      switch (this.type) {
        case LightBoxType.XHTML:
          this.insertFormInHidden().submit();
          break;
        case LightBoxType.FORM_INPUT:
          this.createFormInHidden().submit();
          break;
        case LightBoxType.URL:
          this.createIFrameInWrapper('src', this.url);
          break;
      }
      this.show();
    });
  }

  show() {
    if (!this.isOpened) {
      this.task = LightBox.fadeIn(this.wrapperEl);
      this.isOpened = true;
    }
  }

  close() {
    this.task.then(() => {
      if (this.isOpened) {
        this.task = LightBox.fadeOut(this.wrapperEl);
        this.isOpened = false;
      }
    });
  }

  destroy() {
    this.task.then(() => {
      if (document.getElementById(this.wrapperElId)) {
        document.getElementById(this.wrapperElId).remove();
      }
      if (document.getElementById(this.hiddenElId)) {
        document.getElementById(this.hiddenElId).remove();
      }
    });
  }

  hideLoader() {
    if (this.iframe) {
      this.iframe.className += 'no-spinner';
    }
  }

  private static fadeOut(element): Promise<any> {
    return new Promise((resolve, reject) => {
      element.style.opacity = 0;
      setTimeout(() => {
        element.style.display = 'none';
        setTimeout(resolve, 200);
      }, 200);
    });
  }

  private static fadeIn(element): Promise<any> {
    return new Promise((resolve, reject) => {
      element.style.display = 'block';
      setTimeout(() => {
        element.style.opacity = 1;
        setTimeout(resolve, 200);
      }, 200);
    });
  }
}
