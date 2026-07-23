import Endpoints from '@/constants/endpoints';
import Helpers from '@/helpers/index';
let urls: URLS = {};

interface urlFunc {
  (params?: {}, customerId?: string, domain?: string, useBaseDomain?: boolean): string;
}

interface URLS {
  [name: string]: urlFunc;
}

Object.keys(Endpoints).forEach(function (key) {
  urls[key.toLowerCase()] = function (params, customerId, domain, useBaseDomain: boolean = true) {
    let endPoint = typeof Endpoints[key] == 'function' ? Endpoints[key](params) : Endpoints[key];
    let endpointTemplate;
    if (domain) {
      endpointTemplate = useBaseDomain ? Helpers.getAppDomain(domain) : domain;
    } else {
      endpointTemplate = Helpers.getDomain();
    }
    endpointTemplate += endPoint;

    if (params) {
      if (Object.keys(params).length > 0) {
        endpointTemplate += '?';
      }
      Object.keys(params).forEach(function (param) {
        try {
          params[param] = decodeURIComponent(params[param]);
        } catch (error) {
          // If decoding fails, then it's already encoded or malformed, so keep the original value
        }
        params[param] = encodeURIComponent(params[param]);
        endpointTemplate += param + '=' + params[param] + '&';
      });
      if (Object.keys(params).length > 0) {
        endpointTemplate = endpointTemplate.slice(0, -1);
      }
    }

    return endpointTemplate;
  };
});

export default urls;
