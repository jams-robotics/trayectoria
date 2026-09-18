import { defineConfig } from 'vitest/config';

// Aggregates every package's own vitest config so `pnpm test:coverage` can
// measure coverage across the workspace from the root.
//
// KNOWN GAP (see spec-gap issue linked from #63): the `projects` globs must
// be absolute (anchored on this file's own directory) so that Vite does not
// resolve them against the process cwd — otherwise `pnpm --filter <pkg>
// test` (cwd = that package) fails with "No projects were found". Even with
// that fix, Vitest 4 has no per-package root config, so any package without
// its own vitest.config.ts (all of them except apps/web) still picks up this
// root config and its `projects` list, running the *entire* workspace's
// tests instead of just its own. That breaks `pnpm test`'s previous
// behaviour (each package running only its own tests) and could not be
// solved from this ticket's authorized files alone.
const root = import.meta.dirname.replaceAll('\\', '/');

export default defineConfig({
  test: {
    projects: [`${root}/packages/*`, `${root}/apps/*`],
    coverage: {
      provider: 'v8',
      include: ['packages/sim-core/src/**', 'packages/robot-spec/src/**'],
      exclude: ['**/*.test.ts', '**/index.ts'],
      reporter: ['text'],
      thresholds: {
        perFile: true,
        lines: 90,
      },
    },
  },
});
