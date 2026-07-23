import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import Ids from '@/constants/ids';
import {PlaidConfig} from '../types';
import {Master as M} from '@/hosted_fields/common/enums';
import {loadScriptUsingPredicate} from '@/extensions/three_domain_secure/common/utils';
import Errors, {CbError} from '@/hosted_fields/common/errors';

export default class PlaidHandler {
  private plaidInst: any;

  setupPlaid(plaidConfig: PlaidConfig, paymentIntent) {
    return new Promise(async (resolve, reject) => {
      try {
        const linkToken = await this.checkNLoadScript(plaidConfig, paymentIntent);
        this.plaidInst = this.getPlaid().create({
          env: plaidConfig.env,
          token: linkToken,
          onLoad: () => {
            this.plaidInst.open();
          },
          onSuccess: (public_token, metadata) => {
            resolve({
              publicToken: public_token,
              accountId: metadata.account_id,
              locale: plaidConfig.locale || 'en-US',
            });
          },
          onExit: (err, metadata) => {
            reject(err);
          },
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  getPlaid(): any {
    return window['Plaid'];
  }

  fetchPlaidLinkToken(plaidConfig: PlaidConfig, paymentIntent) {
    const reqData = {
      gw_id: paymentIntent.gateway_account_id,
      user_id: plaidConfig.userId || '',
      locale: plaidConfig.locale || 'en-US',
      paymentIntentId: paymentIntent.id,
    };
    return IframeClientLoader.then((cbIframeClient) =>
      cbIframeClient.send(
        {
          action: M.Actions.FetchPlaidLinkToken,
          data: reqData,
        },
        Ids.MASTER_FRAME,
        {timeout: 10000}
      )
    );
  }

  checkNLoadScript(plaidConfig, paymentIntent): Promise<string> {
    let promises: Promise<any>[] = [this.fetchPlaidLinkToken(plaidConfig, paymentIntent)];
    promises.push(
      loadScriptUsingPredicate('https://cdn.plaid.com/link/v2/stable/link-initialize.js', () => {
        return !!this.getPlaid();
      })
    );
    return new Promise((resolve, reject) => {
      Promise.all(promises)
        .then((args) => {
          resolve(args[0].link_token);
        })
        .catch((error) => {
          reject(new CbError(error));
        });
    });
  }
}
