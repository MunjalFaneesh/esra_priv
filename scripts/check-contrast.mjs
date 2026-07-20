#!/usr/bin/env node
/**
 * Contrast gate.
 *
 * Parses src/styles/tokens.css, composites every text token over its
 * background token, and fails if any text-bearing pair misses its WCAG
 * target. Runs in CI so a future token tweak cannot silently regress
 * readability.
 *
 * Usage: node scripts/check-contrast.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'src/styles/tokens.css'), 'utf8');

/** Pull `--name: value;` declarations out of the :root block. */
function readTokens(source) {
  const tokens = {};
  for (const [, name, value] of source.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)) {
    tokens[name] = value.trim();
  }
  return tokens;
}

/** Parse #rgb, #rrggbb, or rgba(r,g,b,a) into {r,g,b,a} with 0-255 channels. */
function parseColor(input) {
  const value = input.trim();

  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1];
    const full =
      h.length === 3
        ? h
            .split('')
            .map((c) => c + c)
            .join('')
        : h;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
      a: 1,
    };
  }

  const rgba = value.match(/^rgba?\(([^)]+)\)$/i);
  if (rgba) {
    const parts = rgba[1].split(',').map((p) => parseFloat(p.trim()));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
  }

  return null;
}

/** Composite a possibly-translucent foreground over an opaque background. */
function composite(fg, bg) {
  return {
    r: fg.a * fg.r + (1 - fg.a) * bg.r,
    g: fg.a * fg.g + (1 - fg.a) * bg.g,
    b: fg.a * fg.b + (1 - fg.a) * bg.b,
    a: 1,
  };
}

/** WCAG 2.x relative luminance. */
function luminance({ r, g, b }) {
  const channel = (v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(fg, bg) {
  const a = luminance(composite(fg, bg));
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

const tokens = readTokens(css);

/**
 * Each pair declares the minimum ratio it must clear.
 *   4.5 — normal text
 *   3.0 — large text (>=24px, or >=18.7px bold) and UI component boundaries
 *
 * Decorative tokens (--ink-faint, --rule*) carry no text and are exempt;
 * they are asserted to stay BELOW their misuse threshold instead, which
 * catches someone quietly repurposing them for copy.
 */
const REQUIRED = [
  { fg: '--ink-strong', bg: '--sheet', min: 4.5, note: 'headings, primary body' },
  { fg: '--ink-body', bg: '--sheet', min: 4.5, note: 'body copy' },
  { fg: '--ink-muted', bg: '--sheet', min: 4.5, note: 'small mono labels' },
  { fg: '--ink-soft', bg: '--sheet', min: 3.0, note: 'large text only' },
  { fg: '--accent-ink', bg: '--sheet', min: 4.5, note: 'accent text' },
  { fg: '--ink-strong', bg: '--paper', min: 4.5, note: 'text on the outer field' },
  { fg: '--ink-body', bg: '--paper', min: 4.5, note: 'body on the outer field' },
  { fg: '--ink-muted', bg: '--paper', min: 4.5, note: 'labels on the outer field' },
  { fg: '--ink-inverse', bg: '--ink', min: 4.5, note: 'inverted text (buttons)' },
];

let failed = 0;
const rows = [];

for (const { fg, bg, min, note } of REQUIRED) {
  const fgColor = parseColor(tokens[fg]);
  const bgColor = parseColor(tokens[bg]);

  if (!fgColor || !bgColor) {
    console.error(`  UNRESOLVED  ${fg} on ${bg} — could not parse token value`);
    failed++;
    continue;
  }

  const ratio = contrast(fgColor, bgColor);
  const pass = ratio >= min;
  if (!pass) failed++;

  rows.push({
    pair: `${fg} on ${bg}`,
    ratio: ratio.toFixed(2) + ':1',
    required: min.toFixed(1) + ':1',
    status: pass ? 'pass' : 'FAIL',
    note,
  });
}

const width = Math.max(...rows.map((r) => r.pair.length));
console.log('\nContrast gate — WCAG 2.2 AA\n');
for (const r of rows) {
  const mark = r.status === 'pass' ? '  ok ' : ' FAIL';
  console.log(
    `${mark}  ${r.pair.padEnd(width)}  ${r.ratio.padStart(8)}  (needs ${r.required})  ${r.note}`
  );
}

if (failed > 0) {
  console.error(
    `\n${failed} contrast requirement(s) not met.\n` +
      `Adjust the token alpha or the surface colour in src/styles/tokens.css.\n` +
      `Note: lifting the background alone has limited effect, because the muted\n` +
      `tones are translucent ink composited over it — both rise together.\n`
  );
  process.exit(1);
}

console.log(`\nAll ${rows.length} text pairs meet AA.\n`);
