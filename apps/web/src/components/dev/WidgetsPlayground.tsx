import { StoryGallery } from '@trayectoria/widgets/dev';
import type { JSX } from 'react';

/**
 * Reads `?section=<Nombre>` on the client and renders the matching section of the playground
 * (#108, decision 2). Astro's server-side `Astro.url.searchParams` cannot see a query string
 * added after a static build: the page is prerendered at build time and the request URL never
 * reaches it, so the island itself was hydrating with `section: null` in `astro dev` (QA #108,
 * PR #140). Reading `window.location.search` here, on the client, avoids that mismatch outright.
 *
 * Mounted with `client:only="react"` (no SSR pass, so there is nothing to mismatch) from
 * `apps/web/src/pages/dev/widgets.astro`, the only place `window` is allowed (CLAUDE.md,
 * prohibiciones). `StoryGallery` and its `section` prop are unchanged.
 *
 * Se importa desde `@trayectoria/widgets/dev` y no desde el barrel: estando en el barrel, su
 * `import()` de las stories dejaba el chunk de `three` en el grafo de toda página que importa
 * `@trayectoria/widgets` (#154).
 */
export function WidgetsPlayground(): JSX.Element {
  const section = new URLSearchParams(window.location.search).get('section');
  return <StoryGallery section={section} />;
}
