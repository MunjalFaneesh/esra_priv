#!/usr/bin/env node
/**
 * Source-image optimiser.
 *
 * Astro generates sized derivatives at build time, so oversized *sources*
 * only bloat the git history — they never reach a visitor. This caps
 * source dimensions and re-encodes, keeping plenty of quality headroom
 * for future crops while keeping the repo light.
 *
 * Safe to re-run: it only writes when the result is actually smaller, so
 * repeated runs converge rather than degrading images.
 *
 * Run after dropping new photos in:  pnpm optimize:assets
 */

import sharp from 'sharp';
import { readdir, stat, rename, unlink } from 'node:fs/promises';
import { join, extname } from 'node:path';

const TARGETS = [
  { dir: 'src/assets/avatars', max: 800 },
  { dir: 'src/assets/blog', max: 2400 },
  { dir: 'src/assets/gallery', max: 2400 },
  { dir: 'src/assets/logos', max: 1200 },
];

const RASTER = new Set(['.jpg', '.jpeg', '.png']);

let before = 0;
let after = 0;
let changed = 0;

for (const { dir, max } of TARGETS) {
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    continue; // directory not present yet
  }

  for (const name of entries) {
    const path = join(dir, name);
    const ext = extname(name).toLowerCase();
    if (!RASTER.has(ext)) continue;

    const originalSize = (await stat(path)).size;
    before += originalSize;

    const meta = await sharp(path).metadata();
    const tmp = `${path}.tmp`;

    // .rotate() with no argument applies the EXIF orientation and strips
    // it, so phone photos don't render sideways once metadata is dropped.
    let pipeline = sharp(path).rotate();
    if ((meta.width ?? 0) > max) {
      pipeline = pipeline.resize({ width: max, withoutEnlargement: true });
    }

    if (ext === '.png') {
      pipeline = pipeline.png({ compressionLevel: 9, palette: meta.hasAlpha !== true });
    } else {
      pipeline = pipeline.jpeg({ quality: 82, mozjpeg: true });
    }

    await pipeline.toFile(tmp);
    const newSize = (await stat(tmp)).size;

    if (newSize < originalSize) {
      await rename(tmp, path);
      after += newSize;
      changed++;
      console.log(
        `  ${name.padEnd(34)} ${fmt(originalSize)} -> ${fmt(newSize)}   ${meta.width}x${meta.height}`
      );
    } else {
      await unlink(tmp);
      after += originalSize;
      console.log(`  ${name.padEnd(34)} ${fmt(originalSize)} (already optimal)`);
    }
  }
}

function fmt(bytes) {
  return bytes > 1048576
    ? `${(bytes / 1048576).toFixed(1)}MB`.padStart(7)
    : `${Math.round(bytes / 1024)}KB`.padStart(7);
}

console.log(
  `\n${changed} file(s) rewritten. ` +
    `${(before / 1048576).toFixed(1)}MB -> ${(after / 1048576).toFixed(1)}MB ` +
    `(${Math.round((1 - after / before) * 100)}% smaller)\n`
);
