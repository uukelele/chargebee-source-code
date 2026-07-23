import EnvConstants from '@/constants/environment';

export default class VenmoHandlerUtil {
  createVenmoButton() {
    let x = document.createElement('button');
    const venmoCssEl: HTMLLinkElement = document.createElement('link');
    venmoCssEl.rel = 'stylesheet';
    // @ts-ignore
    venmoCssEl.href = `${EnvConstants.ASSET_PATH}/assets/css/venmo.css`;
    document.head.appendChild(venmoCssEl);
    x.classList.add('cb-venmo-button');

    x.style.backgroundImage = `url("${EnvConstants.ASSET_PATH}/assets/venmo-text.svg")`;
    return x;
  }
}
