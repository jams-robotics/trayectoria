import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { EXERCISES } from '@trayectoria/content';
import { describe, expect, it } from 'vitest';

/**
 * Every real exercise key that `<Verifica>` declares across `content/es/**\/index.mdx` must
 * resolve in the live `@trayectoria/content` registry (F6-00). `content:check` used to read
 * `ejercicios.ts` with a regex for this, which could not tell a top-level `defineExercise` id
 * from an unrelated nested `id:`; checking the registry itself is exact, and it is the same map
 * the app renders from. `Verifica.astro` also fails the build on an unknown key, so this is an
 * earlier, faster signal on the same rule.
 *
 * `content` may only import `sim-core` (docs/ARCHITECTURE.md §2), so this lives in `apps/web`,
 * which already reads `content/es` (see `content.config.ts`) and depends on `@trayectoria/content`.
 */

/** Prefix of the registry's own demo key (`demo/track-time`), not a topic exercise. */
const DEMO_KEY_PREFIX = 'demo/';

const contentDir = join(import.meta.dirname, '../../../../content/es');

/** Every `content/es/<ruta>/<mNN-tNN>/index.mdx`. */
function collectTopics(): string[] {
  const files: string[] = [];
  for (const route of readdirSync(contentDir)) {
    const routeDir = join(contentDir, route);
    if (!statSync(routeDir).isDirectory()) continue;
    for (const topic of readdirSync(routeDir)) {
      if (!/^m\d{2}-t\d{2}$/.test(topic)) continue;
      const file = join(routeDir, topic, 'index.mdx');
      try {
        if (statSync(file).isFile()) files.push(file);
      } catch {
        // A topic folder without an index.mdx is not a topic yet.
      }
    }
  }
  return files.sort();
}

/** Keys that `<Verifica>` receives in its `ejercicios={[…]}` prop, unquoted. */
function verificaKeys(mdx: string): string[] {
  const match = /ejercicios=\{\[([^\]]*)\]\}/.exec(mdx);
  if (match === null) return [];
  return match[1]!
    .split(',')
    .map((item) => item.trim().replace(/^['"`]|['"`]$/g, ''))
    .filter((key) => key !== '');
}

describe('Verifica exercise keys', () => {
  it('resolves every non-demo key against the @trayectoria/content registry', () => {
    for (const file of collectTopics()) {
      const topicId = relative(contentDir, file)
        .replace(/[\\/]index\.mdx$/, '')
        .split('\\')
        .join('/');
      const keys = verificaKeys(readFileSync(file, 'utf8')).filter(
        (key) => !key.startsWith(DEMO_KEY_PREFIX),
      );
      for (const key of keys) {
        expect(
          EXERCISES.has(key),
          `${topicId}: <Verifica> declares unknown exercise "${key}"`,
        ).toBe(true);
      }
    }
  });
});
