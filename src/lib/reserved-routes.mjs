/**
 * Top-level paths that a member vanity slug must not take.
 *
 * Plain .mjs rather than .ts so both the Astro build and the Node
 * validation script can import the same list — a second copy would
 * inevitably drift, and the whole point is that the two agree.
 */
export const RESERVED_ROUTES = new Set([
  // pages
  'blog',
  'members',
  'projects',
  'gallery',
  'docs',
  'colophon',
  '404',
  // endpoints and generated output
  'rss.xml',
  'feed-media',
  'og',
  'api',
  '_astro',
  '_vercel',
  '_image',
  // static files in public/
  'admin',
  'media',
  'favicon.svg',
  'favicon.ico',
  'robots.txt',
  'og-default.png',
  'sitemap-index.xml',
  'sitemap-0.xml',
  // plausible future routes, reserved pre-emptively so a member slug never
  // has to be taken away from someone later
  'about',
  'contact',
  'join',
  'sponsors',
  'search',
  'tags',
  'feed',
  'rss',
  'team',
  'hardware',
  'guides',
  'wiki',
  'shop',
  'donate',
]);
