import SouthKoreanCardsHandler from '@/plugins/payments/south_korean_cards/handlers';
import {SouthKoreanCardsPayment} from '@/hosted_fields/common/base-types';
import '@/helpers/polyfills';
import PluginLoader from '@/plugins/core/loader';
import SouthKoreanCardsLoaderInterface from '@/plugins/payments/south_korean_cards/loader/interface';

class SouthKoreanCardsLoader extends PluginLoader implements SouthKoreanCardsLoaderInterface {
  public static southKoreanCardsHandler: SouthKoreanCardsHandler;

  init(): SouthKoreanCardsPayment {
    if (!SouthKoreanCardsLoader.southKoreanCardsHandler) {
      SouthKoreanCardsLoader.southKoreanCardsHandler = new SouthKoreanCardsHandler();
    }
    return SouthKoreanCardsLoader.southKoreanCardsHandler;
  }
}

declare var Chargebee;
Chargebee.getInstance().SouthKoreanCardsPaymentLoader = new SouthKoreanCardsLoader();
