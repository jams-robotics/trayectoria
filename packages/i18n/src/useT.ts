import { useSyncExternalStore } from 'react';

import { i18n, t } from './t';
import type { Translate } from './t';

function subscribe(onLanguageChanged: () => void): () => void {
  i18n.on('languageChanged', onLanguageChanged);
  return () => {
    i18n.off('languageChanged', onLanguageChanged);
  };
}

function getLanguage(): string {
  return i18n.language;
}

/** Returns t() for React islands and re-renders the component when the language changes. */
export function useT(): Translate {
  useSyncExternalStore(subscribe, getLanguage, getLanguage);
  return t;
}
