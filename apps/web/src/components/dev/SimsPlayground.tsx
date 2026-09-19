import { SimGallery } from '@trayectoria/sims';
import type { JSX } from 'react';

/**
 * Reads `?section=<Nombre>` on the client and renders the matching section of the sims
 * playground (#126, decision 2; same shape as `WidgetsPlayground` after PR #140). Astro's
 * server-side `Astro.url.searchParams` cannot see a query string added after a static build, so
 * the URL is read here, on the client, with `client:only="react"` — no SSR pass, nothing to
 * mismatch. This is the only place `window` is allowed (CLAUDE.md, prohibiciones).
 */
export function SimsPlayground(): JSX.Element {
  const section = new URLSearchParams(window.location.search).get('section');
  return <SimGallery section={section} />;
}
