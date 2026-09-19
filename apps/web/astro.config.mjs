import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

import { catalogAssets } from './src/integrations/catalog';

export default defineConfig({
  output: 'static',
  integrations: [react(), mdx(), catalogAssets()],
  vite: {
    plugins: [tailwindcss()],
  },
});
