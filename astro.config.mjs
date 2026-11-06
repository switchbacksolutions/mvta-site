import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Post-submit confirmation pages; keep them out of search results.
const NOINDEX_PATHS = ['/join-success/', '/join-thank-you/'];

export default defineConfig({
  site: 'https://mvtrails.org',
  integrations: [
    mdx(),
    sitemap({ filter: (page) => !NOINDEX_PATHS.some((p) => page.endsWith(p)) }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
