/**
 * Partner logos, redrawn in one ink.
 *
 * Every club and company ships its logo in its own colours. Set side by
 * side they fight each other and the page, so each one is reduced here to
 * a single-colour mark: a white PNG whose alpha channel is the logo's
 * shape. The site paints that shape in its own ink with a CSS mask (see
 * PartnerMark.astro), so a logo follows the theme like text does.
 *
 * How a logo is reduced, with no per-logo configuration:
 *
 *   - One flat colour on a transparent background: the alpha channel is
 *     already the mark.
 *   - Two tones on a transparent background (a white drawing on a
 *     coloured badge): the dominant tone is the ink, the other is knocked
 *     out.
 *   - No transparency (a logo on a solid box): the corner colour is the
 *     background, everything else is ink.
 *
 * If a logo comes out as its own negative, set `logoInvert: true` on the
 * partner record to swap ink and knockout.
 *
 * Build-time only. src/pages/logos/[id].png.ts serves the PNG;
 * PartnerMark.astro reads its size to lay the mark out.
 */
import { join } from 'node:path';

import sharp from 'sharp';

/** Where partner logo sources live, relative to the project root. */
const LOGO_DIR = 'src/assets/logos';

/** Long edge of the generated mark, in px. Marks display at ~96px. */
const SIZE = 384;
/** RGB distance beyond which two colours count as different tones. */
const TONE_GAP = 72;

type RGB = [number, number, number];

const dist = (a: RGB, b: RGB) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Mean colour of the most common tone among the pixels `keep` accepts. */
function dominantTone(
  data: Buffer,
  keep: (r: number, g: number, b: number, a: number) => boolean
): { tone: RGB; count: number } | null {
  // 16 levels per channel: coarse enough to pool anti-aliasing noise,
  // fine enough to keep an orange apart from a red.
  const bins = new Map<number, [number, number, number, number]>();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (!keep(r, g, b, data[i + 3])) continue;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bin = bins.get(key);
    if (bin) {
      bin[0] += r;
      bin[1] += g;
      bin[2] += b;
      bin[3] += 1;
    } else {
      bins.set(key, [r, g, b, 1]);
    }
  }

  let best: [number, number, number, number] | null = null;
  for (const bin of bins.values()) if (!best || bin[3] > best[3]) best = bin;
  if (!best) return null;
  return { tone: [best[0] / best[3], best[1] / best[3], best[2] / best[3]], count: best[3] };
}

/** Where `p` sits between `from` (0) and `to` (1), clamped. */
function between(p: RGB, from: RGB, to: RGB): number {
  const axis: RGB = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const len2 = axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2;
  if (len2 === 0) return 1;
  const t =
    ((p[0] - from[0]) * axis[0] + (p[1] - from[1]) * axis[1] + (p[2] - from[2]) * axis[2]) / len2;
  return Math.min(1, Math.max(0, t));
}

export interface LogoMarkOptions {
  /** Swap ink and knockout. */
  invert?: boolean;
}

export interface LogoMark {
  png: Buffer;
  width: number;
  height: number;
}

const cache = new Map<string, Promise<LogoMark>>();

/**
 * The mark for a partner's `logo` file (a name under src/assets/logos).
 * Memoised: a page and the endpoint that serves the PNG share one render.
 */
export function getPartnerMark(logo: string, options: LogoMarkOptions = {}): Promise<LogoMark> {
  const key = `${logo}|${options.invert ? 1 : 0}`;
  let mark = cache.get(key);
  if (!mark) {
    mark = renderLogoMark(join(process.cwd(), LOGO_DIR, logo), options);
    cache.set(key, mark);
  }
  return mark;
}

/** Reduce the logo at `path` to a white-on-transparent PNG mark. */
export async function renderLogoMark(
  path: string,
  { invert = false }: LogoMarkOptions = {}
): Promise<LogoMark> {
  // An SVG rasterises at its declared size, which is often icon-sized.
  // Raise the density so it arrives at least as large as the mark.
  const meta = await sharp(path).metadata();
  const longEdge = Math.max(meta.width ?? SIZE, meta.height ?? SIZE);
  const density =
    meta.format === 'svg' ? Math.min(2400, Math.ceil((72 * SIZE * 1.5) / longEdge)) : undefined;

  const { data, info } = await sharp(path, density ? { density } : undefined)
    .resize(SIZE, SIZE, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = info.width * info.height;
  let clear = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 16) clear++;
  const hasTransparency = clear / pixels > 0.02;

  /** Ink coverage for one pixel, 0..1. */
  let coverage: (p: RGB, a: number) => number;

  if (hasTransparency) {
    const main = dominantTone(data, (_r, _g, _b, a) => a >= 128);
    if (!main) throw new Error(`logo-mark: "${path}" is fully transparent.`);

    const other = dominantTone(
      data,
      (r, g, b, a) => a >= 128 && dist([r, g, b], main.tone) > TONE_GAP
    );
    const opaque = pixels - clear;

    if (!other || other.count / opaque < 0.01) {
      // One flat colour: the shape is the alpha channel.
      coverage = (_p, a) => a / 255;
    } else {
      coverage = (p, a) => {
        const t = between(p, other.tone, main.tone);
        return (a / 255) * (invert ? 1 - t : t);
      };
    }
  } else {
    // Solid background: read it from the four corners.
    const at = (x: number, y: number): RGB => {
      const i = (y * info.width + x) * 4;
      return [data[i], data[i + 1], data[i + 2]];
    };
    const corners = [
      at(0, 0),
      at(info.width - 1, 0),
      at(0, info.height - 1),
      at(info.width - 1, info.height - 1),
    ];
    const background = corners
      .reduce<RGB>((s, c) => [s[0] + c[0], s[1] + c[1], s[2] + c[2]], [0, 0, 0])
      .map((v) => v / corners.length) as RGB;

    const ink = dominantTone(data, (r, g, b) => dist([r, g, b], background) > TONE_GAP);
    if (!ink) throw new Error(`logo-mark: "${path}" is a single flat colour.`);

    coverage = (p) => {
      const t = between(p, background, ink.tone);
      return invert ? 1 - t : t;
    };
  }

  const out = Buffer.alloc(data.length, 255);
  for (let i = 0; i < data.length; i += 4) {
    out[i + 3] = Math.round(coverage([data[i], data[i + 1], data[i + 2]], data[i + 3]) * 255);
  }

  const { data: png, info: trimmed } = await sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim()
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true });

  return { png, width: trimmed.width, height: trimmed.height };
}
