import type { AstroIntegration } from 'astro';

// #519: the `/dev/*` pages (widget and simulator playgrounds, MDX fixtures for e2e) are not part
// of the public site. They live in `src/dev/pages/`, outside `src/pages/`, and are injected as
// routes only in `astro dev` and in a build run with `DEV_PAGES=1`, which is what the e2e web
// server sets (apps/web/playwright.config.ts) so the visual snapshots and the fixture specs keep
// working in CI. A production build (`pnpm build`, deploy.yml) produces no `dist/dev/`.

/** Environment variable whose value `1` keeps the pages in a build. */
export const DEV_PAGES_ENV = 'DEV_PAGES';

/** A route to inject: URL pattern and page module, relative to the project root (`apps/web`). */
export interface DevRoute {
  readonly pattern: string;
  readonly entrypoint: string;
}

export const DEV_ROUTES: readonly DevRoute[] = [
  { pattern: '/dev/sims', entrypoint: './src/dev/pages/sims.astro' },
  { pattern: '/dev/tema', entrypoint: './src/dev/pages/tema.astro' },
  { pattern: '/dev/tema-seguidor', entrypoint: './src/dev/pages/tema-seguidor.astro' },
  { pattern: '/dev/widgets', entrypoint: './src/dev/pages/widgets.astro' },
];

/** The environment as the integration reads it: only `DEV_PAGES` matters. */
export type Env = Readonly<Record<string, string | undefined>>;

/** Whether the pages are routed: always in `astro dev`; in any other command only with `DEV_PAGES=1`. */
export function devPagesEnabled(command: string, env: Env): boolean {
  return command === 'dev' || env[DEV_PAGES_ENV] === '1';
}

/** Injects the `/dev/*` routes when `devPagesEnabled` says so (#519). */
export function devPages(env: Env = process.env): AstroIntegration {
  return {
    name: 'trayectoria:dev-pages',
    hooks: {
      'astro:config:setup': ({ command, injectRoute, logger }) => {
        if (!devPagesEnabled(command, env)) {
          logger.info(`/dev/* pages left out (set ${DEV_PAGES_ENV}=1 to build them)`);
          return;
        }
        for (const route of DEV_ROUTES) injectRoute(route);
      },
    },
  };
}
