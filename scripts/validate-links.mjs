#!/usr/bin/env node
/**
 * Internal link checker.
 *
 * Walks the built output and confirms every internal href resolves to a
 * page that actually exists. This is the failure mode that shipped on the
 * old site: a blog post linked to /team, /team was later renamed, and
 * nothing caught it.
 *
 * External links are listed but not fetched — a network check would make
 * CI flaky and fail on rate-limited hosts.
 *
 * Run after a build: pnpm validate:links
 */

import { readdir, readFile, access } from 'node:fs/promises';
import { join, extname } from 'node:path';

const DIST = 'dist';

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(path)));
    else if (extname(entry.name) === '.html') out.push(path);
  }
  return out;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Does this internal path resolve to something in dist? */
async function resolves(href) {
  const clean = href.split('#')[0].split('?')[0];
  if (clean === '' || clean === '/') return exists(join(DIST, 'index.html'));

  const rel = clean.replace(/^\//, '');
  return (
    (await exists(join(DIST, rel))) ||
    (await exists(join(DIST, `${rel}.html`))) ||
    (await exists(join(DIST, rel, 'index.html')))
  );
}

let pages;
try {
  pages = await walk(DIST);
} catch {
  console.error(`\nNo ${DIST}/ directory. Run \`pnpm build\` first.\n`);
  process.exit(1);
}

const broken = [];
const external = new Set();
let checked = 0;

for (const page of pages) {
  const html = await readFile(page, 'utf8');

  for (const [, href] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('data:') ||
      href.startsWith('#')
    ) {
      continue;
    }

    if (/^(https?:)?\/\//.test(href)) {
      external.add(href.split('?')[0]);
      continue;
    }

    if (!href.startsWith('/')) continue; // relative asset refs, already resolved by the bundler

    // Emitted by the adapter at request time, not present on disk.
    if (href.startsWith('/_vercel/')) continue;

    checked++;
    if (!(await resolves(href))) {
      broken.push({ page: page.replace(`${DIST}/`, ''), href });
    }
  }
}

console.log(
  `\nChecked ${checked} internal links across ${pages.length} pages ` +
    `(${external.size} distinct external links not fetched).\n`
);

if (broken.length === 0) {
  console.log('All internal links resolve.\n');
  process.exit(0);
}

console.error(`${broken.length} broken internal link(s):\n`);
for (const { page, href } of broken) {
  console.error(`  ${page}`);
  console.error(`    -> ${href}  (no such page)\n`);
}
process.exit(1);
