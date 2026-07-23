import IframeClient from '@/hosted_fields/common/connection/client';
import '@/helpers/polyfills';
import PixPluginInterface from '@/plugins/payments/pix/actions/interface';
import {PluginConfig} from '@/plugins/core/interface';
import CommManagerInterface from '@/hosted_fields/master/interface';

export default class PixActions implements PixPluginInterface {
  config: PluginConfig;
  private iframeClient: IframeClient;

  init(): Promise<void> {
    return Promise.resolve();
  }

  constructor(commMgr: CommManagerInterface) {
    this.iframeClient = commMgr.connectionClient;
  }
}
