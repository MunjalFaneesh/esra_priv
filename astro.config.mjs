// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import icon from 'astro-icon';

import { remarkWordCount } from './src/lib/remark-word-count.mjs';

/**
 * Canonical origin. Every absolute URL on the site (sitemap, RSS, OG tags)
 * derives from this single value — switching domains is a one-line change.
 * Vercel preview deploys override it so previews self-reference correctly.
 */
const SITE_URL =
  process.env.SITE_URL ??
  (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://esra.bot');

export default defineConfig({
  site: SITE_URL,
  adapter: vercel({
    // Static output — the whole site prerenders. The adapter is here for
    // Vercel's image optimizer and correct routing, not for SSR.
    imageService: true,
  }),
  output: 'static',

  // Matches the old Nuxt site's `autoSubfolderIndex: false`, so migrated
  // URLs resolve without a redirect hop.
  trailingSlash: 'never',

  integrations: [
    mdx(),
    icon({
      include: {
        'simple-icons': [
          'github',
          'linkedin',
          'youtube',
          'instagram',
          'x',
          'bluesky',
          'gmail',
          'rss',
          'kicad',
        ],
        lucide: ['globe', 'mail', 'arrow-up-right', 'external-link', 'chevron-right'],
      },
    }),
    sitemap({
      filter: (page) => !page.includes('/admin'),
    }),
  ],

  markdown: {
    remarkPlugins: [remarkWordCount],
    shikiConfig: {
      // Light-only: the site has a single paper-toned theme by design.
      theme: 'github-light',
      wrap: false,
    },
  },

  image: {
    // Generated derivatives stay modest; the source photos are multi-megabyte.
    responsiveStyles: true,
    layout: 'constrained',
  },

  build: {
    inlineStylesheets: 'auto',
  },

  vite: {
    build: {
      cssMinify: 'lightningcss',
    },
  },
});
