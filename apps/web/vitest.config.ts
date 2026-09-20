import { configDefaults, defineConfig } from 'vitest/config';

// Playwright owns apps/web/e2e (playwright.config.ts); Vitest must not pick up its *.spec.ts.
// Coverage mirrors sim-core and widgets: 90 % lines per file (F3-02a, decision 8). Only the
// modules that have tests are included, so an untested .astro page does not sink the threshold.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'e2e/**'],
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
