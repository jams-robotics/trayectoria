import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
      reporter: ['text'],
      thresholds: {
        perFile: true,
        lines: 90,
      },
    },
  },
});
