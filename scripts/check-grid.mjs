#!/usr/bin/env node
/**
 * Baseline-grid guard.
 *
 * The whole design sits on a 24px grid. A line height that is not a
 * multiple of 24px pushes everything below it off the grid by the
 * remainder, and the offset accumulates down the page.
 *
 * This regressed once already: page titles were written with unitless
 * ratios (`line-height: 1.05`), which at a 52px display size resolves to
 * ~54.6px — about 7px past the 48px two-cell mark. Visible as headings and
 * everything under them sitting a third of a cell low.
 *
 * So: unitless line heights are rejected on anything large enough to
 * matter, and pixel values must divide by 24.
 *
 * Run: pnpm check:grid
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const UNIT = 24;

/** Sub-grid line heights that are deliberate and allowed. */
const ALLOWED_TOKENS = new Set([
  'var(--lh-grid)', // 24px
  'var(--lh-h1)', // 48px
  'var(--lh-hero)', // 72px
  'var(--lh-snug)', // 18px — captions and margin notes, intentionally sub-grid
  'var(--lh-tight)', // 1 — single-line chrome where the box sets the height
  'var(--lh-loose)', // 1.6 — long-form fallback
  'inherit',
  'normal',
  '1',
]);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(path)));
    else if (['.astro', '.css'].includes(extname(entry.name))) out.push(path);
  }
  return out;
}

const files = await walk('src');
const problems = [];

for (const file of files) {
  const text = await readFile(file, 'utf8');

  text.split('\n').forEach((line, i) => {
    const match = line.match(/line-height:\s*([^;]+);/);
    if (!match) return;

    // Some text genuinely sits outside the main flow — figure captions,
    // code blocks, two-line labels whose pair sums to one cell. Those may
    // opt out, but must say why, so the exception is a decision on the
    // record rather than an oversight.
    if (/\/\*\s*sub-grid:/.test(line)) return;

    const value = match[1].trim();
    if (ALLOWED_TOKENS.has(value)) return;

    // A bare number is a ratio — it resolves against font-size, so it
    // almost never lands on the grid for display type.
    if (/^[\d.]+$/.test(value)) {
      problems.push({
        file,
        line: i + 1,
        value,
        why: 'unitless ratio — resolves against font-size, so it will not land on the grid',
        fix: 'use var(--lh-grid) / var(--lh-h1) / var(--lh-hero)',
      });
      return;
    }

    const px = value.match(/^(\d+)px$/);
    if (px && Number(px[1]) % UNIT !== 0) {
      const n = Number(px[1]);
      problems.push({
        file,
        line: i + 1,
        value,
        why: `${n}px is not a multiple of ${UNIT}px (off by ${n % UNIT}px)`,
        fix: `use ${Math.round(n / UNIT) * UNIT}px, or a --lh- token`,
      });
    }
  });
}

if (problems.length === 0) {
  console.log(`\nBaseline grid OK — every line height is grid-aligned or an allowed token.\n`);
  process.exit(0);
}

console.error(`\n${problems.length} line height(s) break the ${UNIT}px baseline grid:\n`);
for (const p of problems) {
  console.error(`  ${p.file}:${p.line}`);
  console.error(`    line-height: ${p.value}  — ${p.why}`);
  console.error(`    ${p.fix}\n`);
}
process.exit(1);
