import { defineConfig } from 'vitest/config';

// `useProgress` and the adapter are React-facing, so the suite needs a DOM, and the stores
// need `localStorage` (docs/ARCHITECTURE.md §7). Coverage mirrors widgets: 90 % lines per file,
// barrels excluded.
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/index.ts'],
      reporter: ['text'],
      thresholds: {
        perFile: true,
        lines: 90,
      },
    },
  },
});
