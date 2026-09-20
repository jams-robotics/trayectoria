import { createInstance } from 'i18next';

import auth from '../locales/es/auth.json';
import aula from '../locales/es/aula.json';
import es from '../locales/es/common.json';
import progress from '../locales/es/progress.json';
import sims from '../locales/es/sims.json';
import widgets from '../locales/es/widgets.json';

// Namespace `common` = common.json plus auth.json under the root key `auth` (F0-08),
// widgets.json under the root key `widgets` (F2-01a), progress.json under `progress` (F3-01),
// aula.json under `aula` (F3-02a) and sims.json under `sims` (F4-01b).
export const resources = { es: { common: { ...es, auth, aula, progress, sims, widgets } } };

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
  resources,
  initAsync: false,
  // Astro and React already escape rendered text; escaping here too would double-escape titles.
  interpolation: { escapeValue: false },
});

export const t: Translate = (key, params) => i18n.t(key, params ?? {});
