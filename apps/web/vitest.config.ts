import { configDefaults, defineConfig } from 'vitest/config';

// Playwright owns apps/web/e2e (playwright.config.ts); Vitest must not pick up its *.spec.ts.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
});
