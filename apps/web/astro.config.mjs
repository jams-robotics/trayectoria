import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

import { catalogAssets } from './src/integrations/catalog';
import { devPages } from './src/integrations/devPages';
import { TOPIC_REDIRECTS } from './src/lib/redirects';

export default defineConfig({
  site: 'https://trayectoria.org',
  output: 'static',
  // Old topic URLs of the single route → their new URL (#574, docs/ARCHITECTURE.md §3.2).
  redirects: { ...TOPIC_REDIRECTS },
  integrations: [react(), mdx(), catalogAssets(), devPages()],
  vite: {
    plugins: [tailwindcss()],
  },
});
