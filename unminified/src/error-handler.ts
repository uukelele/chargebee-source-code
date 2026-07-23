import Handler from '@/models/handler';
import Helpers from '@/helpers/index';

export enum ErrorType {
  hostMisMatch,
}

interface Payload {
  key: ErrorType;
  data: any;
}

export default class ErrorHandler {
  payload: Payload;

  constructor(payload: Payload) {
    this.payload = payload;
  }

  public handle() {
    if (Reflect.has(this, ErrorType[this.payload.key])) {
      Reflect.apply(Reflect.get(this, ErrorType[this.payload.key]), this, []);
    } else {
      throw new Error('unknown key');
    }
  }

  private parseIncomingSite(origin): string {
    let match = origin.match(/^https?\:\/\/([^\/?#]+).chargebee.com(?:[\/?#]|$)/i);
    return match ? match[1] : '';
  }

  public hostMisMatch() {
    let origin = this.payload.data.origin;
    let cbInstance = Helpers.getCbInstance();
    let actualSite = cbInstance.site;
    let incomingSite = this.parseIncomingSite(origin);
    Handler.reset();

    // extract subdomain and check it with the site
    // if its a test site, throw error
    // else just throw error
    if (`${incomingSite}-test` == actualSite) {
      throw new Error('You have configured chargebee with test site. Please configure it with live site');
    }
    if (`${actualSite}-test` == incomingSite) {
      throw new Error('You have configured chargebee with live site. But the url still points to the test site');
    }

    throw new Error(
      'If you have configured custom domain, please set the domain name in the script tag as mentioned in the docs'
    );
  }
}
