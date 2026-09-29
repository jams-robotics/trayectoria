import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test, vi } from 'vitest';

import { DEV_PAGES_ENV, DEV_ROUTES, devPages, devPagesEnabled } from './devPages';

// #519: the /dev/* pages exist in `astro dev` and in a build with DEV_PAGES=1 (the e2e web
// server), and in no other build.

/** `apps/web`, the project root the entrypoints are relative to. */
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Runs the config hook of the integration and returns the patterns it injected. */
function injectedPatterns(command: string, env: Record<string, string>): string[] {
  const injected: string[] = [];
  const hook = devPages(env).hooks['astro:config:setup'];
  if (hook === undefined) throw new Error('the integration has no astro:config:setup hook');
  // Only the three members the hook reads; the rest of Astro's options are not needed here.
  const options = {
    command,
    injectRoute: (route: { pattern: string }) => {
      injected.push(route.pattern);
    },
    logger: { info: vi.fn() },
  };
  void hook(options as never);
  return injected;
}

describe('integración de páginas /dev (#519)', () => {
  test('astro dev siempre las incluye; cualquier otro comando solo con DEV_PAGES=1', () => {
    expect(devPagesEnabled('dev', {})).toBe(true);
    expect(devPagesEnabled('build', {})).toBe(false);
    expect(devPagesEnabled('build', { [DEV_PAGES_ENV]: '1' })).toBe(true);
    expect(devPagesEnabled('build', { [DEV_PAGES_ENV]: 'true' })).toBe(false);
    expect(devPagesEnabled('build', { [DEV_PAGES_ENV]: '' })).toBe(false);
    expect(devPagesEnabled('preview', {})).toBe(false);
  });

  test('un build de producción no inyecta ninguna ruta /dev/*', () => {
    expect(injectedPatterns('build', {})).toEqual([]);
  });

  test('con DEV_PAGES=1 inyecta las cuatro páginas', () => {
    expect(injectedPatterns('build', { [DEV_PAGES_ENV]: '1' })).toEqual([
      '/dev/sims',
      '/dev/tema',
      '/dev/tema-seguidor',
      '/dev/widgets',
    ]);
    expect(injectedPatterns('dev', {})).toHaveLength(DEV_ROUTES.length);
  });

  test('cada entrada apunta a una página que existe fuera de src/pages', () => {
    for (const route of DEV_ROUTES) {
      expect(route.entrypoint.startsWith('./src/dev/pages/')).toBe(true);
      expect(existsSync(resolve(PROJECT_ROOT, route.entrypoint))).toBe(true);
    }
    expect(existsSync(resolve(PROJECT_ROOT, 'src/pages/dev'))).toBe(false);
  });
});
