import ThreeDSecureHandler from '@/extensions/three_domain_secure';
import CbInstanceOptions from '@/interfaces/cb-instance-options';
import {ThreeDSHandler} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import ThreeDSLoaderInterface from '@/plugins/three_domain_secure/loader/interface';

class ThreeDSLoader extends PluginLoader implements ThreeDSLoaderInterface {
  public static threeDSHandler: ThreeDSecureHandler;

  init(): ThreeDSHandler {
    if (!ThreeDSLoader.threeDSHandler) {
      const options: CbInstanceOptions = Chargebee.getInstance().options;
      ThreeDSLoader.threeDSHandler = new ThreeDSecureHandler(options);
    }
    return ThreeDSLoader.threeDSHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().threeDSLoader = new ThreeDSLoader();
