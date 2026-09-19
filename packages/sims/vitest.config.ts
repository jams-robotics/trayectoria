import { defineConfig } from 'vitest/config';

// Sims compose sim-core with React widgets, so tests need a DOM (docs/ARCHITECTURE.md §7).
// Coverage mirrors sim-core: 90 % lines per file, stories and barrels excluded.
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.stories.tsx', 'src/**/index.ts'],
      reporter: ['text'],
      thresholds: {
        perFile: true,
        lines: 90,
      },
    },
  },
});
