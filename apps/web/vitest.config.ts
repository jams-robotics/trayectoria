import { configDefaults, defineConfig } from 'vitest/config';

// Playwright owns apps/web/e2e (playwright.config.ts); Vitest must not pick up its *.spec.ts.
// Coverage mirrors sim-core and widgets: 90 % lines per file (F3-02a, decision 8). Only the
// modules that have tests are included, so an untested .astro page does not sink the threshold.

// The bundle budget reads apps/web/dist, so it only makes sense after `pnpm build`, and it now
// fails instead of skipping when dist/ is missing (#208). The plain `pnpm test` run therefore
// leaves it out; CI runs it in its own step of the build job, where BUNDLE_BUDGET=1 selects it
// as the only test file.
const BUNDLE_BUDGET_TEST = 'src/lib/bundle/bundleBudget.test.ts';
const bundleBudgetOnly = process.env.BUNDLE_BUDGET === '1';

export default defineConfig({
  test: {
    include: bundleBudgetOnly ? [BUNDLE_BUDGET_TEST] : configDefaults.include,
    exclude: bundleBudgetOnly
      ? [...configDefaults.exclude]
      : [...configDefaults.exclude, 'e2e/**', BUNDLE_BUDGET_TEST],
    coverage: {
      provider: 'v8',
      include: ['src/lib/aula/**'],
      exclude: ['src/**/*.test.ts'],
      reporter: ['text'],
      thresholds: {
        perFile: true,
        lines: 90,
      },
    },
  },
});
