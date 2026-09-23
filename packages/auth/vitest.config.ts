import { defineConfig } from 'vitest/config';

// useSession.test.tsx hydrates React with react-dom/client, which needs a DOM.
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
