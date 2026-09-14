import { createInstance } from 'i18next';

import es from '../locales/es/common.json';

export const DEFAULT_LANGUAGE = 'es';

/** Values interpolated into a translation: `t('meta.title', { title })` fills `{{title}}`. */
export type TParams = Record<string, string | number>;

/** Translates a dot-notation key (`nav.home`); a missing key comes back as the key itself. */
export type Translate = (key: string, params?: TParams) => string;

// One instance for the whole app. Astro calls t() while building static pages, so the resources
// are bundled and init is synchronous (initAsync: false, nothing loaded asynchronously).
export const i18n = createInstance();

void i18n.init({
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  defaultNS: 'common',
  resources: { es: { common: es } },
  initAsync: false,
  // Astro and React already escape rendered text; escaping here too would double-escape titles.
  interpolation: { escapeValue: false },
});

export const t: Translate = (key, params) => i18n.t(key, params ?? {});
