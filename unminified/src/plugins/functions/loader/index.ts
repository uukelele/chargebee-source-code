import Errors, {CbError} from '@/hosted_fields/common/errors';
import {Master} from '@/hosted_fields/common/enums';
import FunctionsPluginLoaderInterface, {
  EstimateFunctionsPluginLoaderInterface,
  VatValidationFunctionsPluginLoaderInterface,
} from '@/plugins/functions/loader/interface';
import PluginLoader from '@/plugins/core/loader';
import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import Ids from '@/constants/ids';
import {
  CreateSubscriptionEstimate,
  UpdateSubscriptionEstimate,
  SubscriptionRenewalEstimate,
  VatValidationParams,
} from '@/plugins/functions/types';

declare var Chargebee;

class FunctionsPluginLoader extends PluginLoader implements FunctionsPluginLoaderInterface {
  public estimates: EstimateFunctionsPluginLoaderInterface = {
    createSubscriptionEstimate(data: CreateSubscriptionEstimate): Promise<any> {
      return IframeClientLoader.then((cbIframeClient) =>
        cbIframeClient.send(
          {
            action: Master.Actions.CreateSubscriptionEstimate,
            data,
          },
          Ids.MASTER_FRAME
        )
      );
    },

    updateSubscriptionEstimate(data: UpdateSubscriptionEstimate): Promise<any> {
      return IframeClientLoader.then((cbIframeClient) =>
        cbIframeClient.send(
          {
            action: Master.Actions.UpdateSubscriptionEstimate,
            data,
          },
          Ids.MASTER_FRAME
        )
      );
    },

    renewSubscriptionEstimate(data: SubscriptionRenewalEstimate): Promise<any> {
      return IframeClientLoader.then((cbIframeClient) =>
        cbIframeClient.send(
          {
            action: Master.Actions.RenewSubscriptionEstimate,
            data,
          },
          Ids.MASTER_FRAME
        )
      );
    },
  };

  public vat: VatValidationFunctionsPluginLoaderInterface = {
    validateVat(data: VatValidationParams): Promise<any> {
      return IframeClientLoader.then((cbIframeClient) =>
        cbIframeClient.send(
          {
            action: Master.Actions.ValidateVat,
            data,
          },
          Ids.MASTER_FRAME,
          {timeout: 60000}
        )
      );
    },
  };
}

Chargebee.getInstance().functionsPluginLoader = new FunctionsPluginLoader();
