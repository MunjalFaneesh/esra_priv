/**
 * Media resolution for the RSS feed.
 *
 * The requirement is that the feed "handles diverse forms of media
 * autonomously" — an author should never hand-configure an enclosure.
 * This inspects whatever a post declares and derives the right feed
 * representation from it:
 *
 *   local image  -> feed-sized JPEG derivative, real byte length
 *   local video  -> enclosure with the real file size, plus a poster
 *   YouTube URL  -> media:player + thumbnail, no enclosure
 *   audio        -> enclosure with its real size
 *   nothing      -> no enclosure at all (never a fake one)
 *
 * Enclosure lengths are REAL byte counts. Feed readers use them for
 * download progress and some reject items whose length is wrong, so a
 * guessed number is worse than none.
 */
import { stat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import type { ImageMetadata } from 'astro';

import { diskPathFor } from './assets';

/** Feed images are capped well below the source masters. */
const FEED_WIDTH = 1200;
const FEED_QUALITY = 80;

export interface FeedMedia {
  url: string;
  mime: string;
  /** Byte length. Always measured, never estimated. */
  length: number;
  width?: number;
  height?: number;
  /** Separate thumbnail for media:thumbnail. */
  thumbnail?: string;
  /** For embeds, the player page rather than a downloadable file. */
  player?: string;
  medium: 'image' | 'video' | 'audio';
}

/** Build-time cache so the endpoint and the feed do the work once. */
const derivativeCache = new Map<string, { buffer: Buffer; mime: string }>();

/**
 * Produce (and memoise) the feed-sized derivative of a local image.
 * Returns null if the source can't be located on disk.
 */
export async function feedDerivative(
  image: ImageMetadata
): Promise<{ buffer: Buffer; mime: string } | null> {
  const key = image.src;
  const cached = derivativeCache.get(key);
  if (cached) return cached;

  const diskPath = diskPathFor(image);
  if (!diskPath) return null;

  try {
    const buffer = await sharp(diskPath)
      .rotate()
      .resize({ width: FEED_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: FEED_QUALITY, mozjpeg: true })
      .toBuffer();

    const result = { buffer, mime: 'image/jpeg' };
    derivativeCache.set(key, result);
    return result;
  } catch (err) {
    console.warn(`[feed-media] could not derive ${diskPath}: ${(err as Error).message}`);
    return null;
  }
}

/** Stable public URL for a post's feed image. */
export function feedImageUrl(postId: string, site: string): string {
  return new URL(`/feed-media/${postId}.jpg`, site).href;
}

/** Resolve a local image into a full enclosure description. */
export async function imageEnclosure(
  image: ImageMetadata,
  postId: string,
  site: string
): Promise<FeedMedia | null> {
  const derived = await feedDerivative(image);
  if (!derived) return null;

  return {
    url: feedImageUrl(postId, site),
    mime: derived.mime,
    length: derived.buffer.byteLength,
    width: Math.min(FEED_WIDTH, image.width),
    height:
      image.width > FEED_WIDTH
        ? Math.round((image.height * FEED_WIDTH) / image.width)
        : image.height,
    medium: 'image',
  };
}

const MIME_BY_EXT: Record<string, { mime: string; medium: FeedMedia['medium'] }> = {
  '.mp4': { mime: 'video/mp4', medium: 'video' },
  '.webm': { mime: 'video/webm', medium: 'video' },
  '.mov': { mime: 'video/quicktime', medium: 'video' },
  '.mp3': { mime: 'audio/mpeg', medium: 'audio' },
  '.m4a': { mime: 'audio/mp4', medium: 'audio' },
  '.wav': { mime: 'audio/wav', medium: 'audio' },
  '.opus': { mime: 'audio/opus', medium: 'audio' },
  '.jpg': { mime: 'image/jpeg', medium: 'image' },
  '.jpeg': { mime: 'image/jpeg', medium: 'image' },
  '.png': { mime: 'image/png', medium: 'image' },
  '.webp': { mime: 'image/webp', medium: 'image' },
};

/**
 * Enclosure for a file served from public/ — video and audio, which
 * Astro's image pipeline does not process.
 */
export async function publicFileEnclosure(
  publicPath: string,
  site: string
): Promise<FeedMedia | null> {
  const ext = publicPath.slice(publicPath.lastIndexOf('.')).toLowerCase();
  const type = MIME_BY_EXT[ext];
  if (!type) return null;

  try {
    const { size } = await stat(join('public', publicPath.replace(/^\//, '')));
    return {
      url: new URL(publicPath, site).href,
      mime: type.mime,
      length: size,
      medium: type.medium,
    };
  } catch {
    console.warn(`[feed-media] missing public file: ${publicPath}`);
    return null;
  }
}

/** Recognise a YouTube URL and pull the video ID out of any of its forms. */
export function youtubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return match?.[1] ?? null;
}

/** Embeds are referenced, not enclosed — there is no file to download. */
export function embedMedia(url: string): FeedMedia | null {
  const id = youtubeId(url);
  if (!id) return null;

  return {
    url,
    player: `https://www.youtube.com/embed/${id}`,
    thumbnail: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
    mime: 'text/html',
    length: 0,
    medium: 'video',
  };
}

/** Read a derivative back out for the serving endpoint. */
export async function readFeedDerivative(image: ImageMetadata): Promise<Buffer | null> {
  const derived = await feedDerivative(image);
  return derived?.buffer ?? null;
}

export { FEED_WIDTH, FEED_QUALITY };
