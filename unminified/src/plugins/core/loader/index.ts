import PluginLoaderInterface from '@/plugins/core/loader/loader-interface';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';

class PluginLoader implements PluginLoaderInterface {
  public loaderPromise: Promise<any>;

  constructor() {
    this.initialize();
  }

  initialize() {
    this.loaderPromise = this.create();
  }

  create(): Promise<any> {
    return IframeClientLoader.then((cbIframeClient) => cbIframeClient.createMasterFrame());
  }

  listen(event) {
    IframeClientLoader.then((cbIframeClient) => cbIframeClient.listen(event));
  }
}

export default PluginLoader;
