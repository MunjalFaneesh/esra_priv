#!/usr/bin/env node
/**
 * Baseline-grid guard.
 *
 * The whole design sits on a 24px grid, and there are two independent
 * ways to fall off it. This checks both.
 *
 * 1. LINE HEIGHT. A line box that is not a multiple of 24px pushes
 *    everything below it off the grid by the remainder, and the offset
 *    accumulates down the page. Unitless ratios are the trap: `1.05` on
 *    a 52px display size resolves to ~54.6px, ~7px past the 48px
 *    two-cell mark. That shipped once.
 *
 * 2. BASELINE POSITION. Fixing (1) is necessary but not sufficient, and
 *    this is the subtler failure. A 24px line box does not put the
 *    baseline at 24px — half-leading puts it wherever the font's own
 *    metrics say, and IBM Plex Mono is unusually tall (1.3em content
 *    box). At 12px that lands the baseline 7.5px above the grid line:
 *    the "about a third of a cell low" reported in review. The fix is
 *    the .on-grid utility in global.css, and the maths depends on a
 *    constant read out of the font itself.
 *
 * So this script re-derives that constant FROM THE FONT FILE on every
 * run. Swap the typeface and the check fails loudly rather than letting
 * the site drift off-grid with everything still nominally "correct".
 *
 * Run: pnpm check:grid
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { inflateSync } from 'node:zlib';

const UNIT = 24;
const FONT = 'node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff';
// Running text is set in Plex Sans. The .on-grid correction uses one
// constant for every element, so the sans face must measure the same.
const COMPANION_FONTS = [
  'node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff',
  'node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff',
];

const problems = [];
const fail = (file, line, what, why, fix) => problems.push({ file, line, what, why, fix });

// ---------------------------------------------------------------------
// Read the font's vertical metrics straight out of the woff.
// ---------------------------------------------------------------------
function readFontMetrics(buf) {
  if (buf.toString('ascii', 0, 4) !== 'wOFF') throw new Error(`${FONT} is not a woff file`);
  const tables = {};
  const numTables = buf.readUInt16BE(12);
  for (let i = 0; i < numTables; i++) {
    const o = 44 + i * 20;
    const tag = buf.toString('ascii', o, o + 4);
    const off = buf.readUInt32BE(o + 4);
    const compLen = buf.readUInt32BE(o + 8);
    const origLen = buf.readUInt32BE(o + 12);
    const raw = buf.subarray(off, off + compLen);
    tables[tag] = compLen !== origLen ? inflateSync(raw) : raw;
  }

  const upem = tables.head.readUInt16BE(18);
  // Browsers lay out from hhea ascent/descent for web fonts, so those are
  // the numbers that decide where the baseline actually lands.
  const ascent = tables.hhea.readInt16BE(4) / upem;
  const descent = -tables.hhea.readInt16BE(6) / upem;
  const lineGap = tables.hhea.readInt16BE(8) / upem;
  const content = ascent + descent + lineGap;

  // baseline = line-height/2 + (ascent - content/2) * font-size
  return { upem, ascent, descent, content, k: ascent - content / 2 };
}

// ---------------------------------------------------------------------
// Check 1 — the --bl-k token still matches the font.
// ---------------------------------------------------------------------
const metrics = readFontMetrics(await readFile(FONT));
const tokens = await readFile('src/styles/tokens.css', 'utf8');
const declared = tokens.match(/--bl-k:\s*([\d.]+)\s*;/);

if (!declared) {
  fail(
    'src/styles/tokens.css',
    0,
    '--bl-k is missing',
    'the baseline correction has nothing to compute from',
    `add:  --bl-k: ${metrics.k};`
  );
} else if (Math.abs(Number(declared[1]) - metrics.k) > 0.0005) {
  fail(
    'src/styles/tokens.css',
    tokens.slice(0, declared.index).split('\n').length,
    `--bl-k is ${declared[1]}, but the font measures ${metrics.k.toFixed(4)}`,
    'text baselines will sit off the grid by up to a third of a cell',
    `set:  --bl-k: ${metrics.k};`
  );
}

for (const path of COMPANION_FONTS) {
  const m = readFontMetrics(await readFile(path));
  if (Math.abs(m.k - metrics.k) > 0.0005) {
    fail(
      path,
      0,
      `companion face measures --bl-k ${m.k.toFixed(4)}, Plex Mono ${metrics.k.toFixed(4)}`,
      'sans text would land off the grid with the shared baseline correction',
      'use a face with matching hhea metrics, or give it its own correction constant'
    );
  }
}

// ---------------------------------------------------------------------
// Check 2 — line heights are grid multiples.
// ---------------------------------------------------------------------
const ALLOWED = new Set([
  'var(--lh-grid)', // 24px
  'var(--lh-h1)', // 48px
  'var(--lh-hero)', // 72px
  'var(--lh)', // whatever the element declared, itself one of the above
  'var(--lh-snug)', // 18px — captions and margin notes, intentionally sub-grid
  'inherit',
  'normal',
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

for (const file of files) {
  const text = await readFile(file, 'utf8');

  text.split('\n').forEach((line, i) => {
    // The trailing semicolon is optional: a declaration can legally be the
    // last one in its block. Requiring it here would let that case through.
    const match = line.match(/line-height:\s*([^;}]+)/);
    if (!match) return;

    // Some text genuinely sits outside the main flow — figure captions,
    // code blocks, two-line labels whose pair sums to one cell. Those may
    // opt out, but must say why, so the exception is a decision on the
    // record rather than an oversight.
    if (/\/\*\s*sub-grid:/.test(line)) return;

    const value = match[1].trim();
    if (ALLOWED.has(value)) return;

    // A bare number is a ratio — it resolves against font-size, so it
    // almost never lands on the grid for display type.
    if (/^[\d.]+$/.test(value)) {
      fail(
        file,
        i + 1,
        `line-height: ${value}`,
        'unitless ratio — resolves against font-size, so it will not land on the grid',
        'use var(--lh-grid) / var(--lh-h1) / var(--lh-hero)'
      );
      return;
    }

    const px = value.match(/^(\d+)px$/);
    if (px && Number(px[1]) % UNIT !== 0) {
      const n = Number(px[1]);
      fail(
        file,
        i + 1,
        `line-height: ${value}`,
        `${n}px is not a multiple of ${UNIT}px (off by ${n % UNIT}px)`,
        `use ${Math.round(n / UNIT) * UNIT}px, or a --lh- token`
      );
    }
  });
}

// ---------------------------------------------------------------------
// Check 3 — page titles and ledes carry the baseline correction.
//
// These are the two elements that open almost every page, so when they
// drift the whole page reads as misaligned. A grid-multiple line height
// alone does not put them on the grid; they need .on-grid too.
// ---------------------------------------------------------------------
for (const file of files.filter((f) => f.endsWith('.astro'))) {
  const text = await readFile(file, 'utf8');

  text.split('\n').forEach((line, i) => {
    for (const [re, what] of [
      [/<h1(?![\w-])(?![^>]*\bon-grid\b)[^>]*>/, 'a <h1>'],
      [/class="lede(?![^"]*\bon-grid\b)[^"]*"/, 'a .lede'],
    ]) {
      if (re.test(line)) {
        fail(
          file,
          i + 1,
          `${what} without the baseline correction`,
          'a grid line height alone leaves the baseline mid-cell — see --bl-k in tokens.css',
          'add the on-grid class, e.g.  <h1 class="on-grid">'
        );
      }
    }
  });
}

// ---------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------
if (problems.length === 0) {
  console.log(
    `\nBaseline grid OK — line heights grid-aligned, and --bl-k matches the font ` +
      `(ascent ${metrics.ascent.toFixed(3)}em over a ${metrics.content.toFixed(3)}em content box).\n`
  );
  process.exit(0);
}

console.error(`\n${problems.length} baseline-grid problem(s):\n`);
for (const p of problems) {
  console.error(`  ${p.file}${p.line ? `:${p.line}` : ''}`);
  console.error(`    ${p.what}  — ${p.why}`);
  console.error(`    ${p.fix}\n`);
}
process.exit(1);
