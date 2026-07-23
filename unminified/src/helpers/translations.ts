import IframeClientLoader from '@/hosted_fields/host/iframe-client-loader';
import {Master as M} from '@/hosted_fields/common/enums';
import {getLanguageCode, setLocaleText, DefaultLocale} from '@/hosted_fields/common/locale';
import Ids from '@/constants/ids';

export function loadTranslations(locale = DefaultLocale): Promise<void> {
  // TODO: Refactor after CDN caching is fixed
  // As default translations will be available in backend, no need to load it separately

  // Load translations for default locale if not loaded already
  // IframeClientLoader.then(cbIframeClient => cbIframeClient.send({
  //   action: M.Actions.GetTranslations,
  //   data: {
  //     locale: DefaultLocale,
  //     languageCode: getLanguageCode(DefaultLocale),
  //   }
  // }, Ids.MASTER_FRAME, { timeout: 10000 }))
  //   .then((data: any) => {
  //     setLocaleText(data);
  //   })

  return IframeClientLoader.then((cbIframeClient) =>
    cbIframeClient.send(
      {
        action: M.Actions.GetTranslations,
        data: {
          locale,
          languageCode: getLanguageCode(locale),
        },
      },
      Ids.MASTER_FRAME,
      {timeout: 10000}
    )
  ).then((data: any) => {
    setLocaleText(data);
  });
}
