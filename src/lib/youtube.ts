/**
 * YouTube video data, fetched at build time.
 *
 * Uses each channel's public RSS feed rather than the Data API — no key
 * to manage, no quota, and no secret to leak into a static build.
 *
 * The feed is keyed by channel ID, but the org registry records handles
 * (@RutgersDynamics), so the handle is resolved to an ID once and cached.
 *
 * Like the GitHub client: never fabricates, never fails the build, falls
 * back to the last good snapshot.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { YOUTUBE_SOURCES } from '../data/orgs';

const CACHE_FILE = join('.cache', 'youtube.json');
const TTL_MS = 1000 * 60 * 60 * 6;

export interface Video {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  published: string;
  channelTitle: string;
  orgId: string;
  orgName: string;
}

interface Snapshot {
  fetchedAt: number;
  channelIds: Record<string, string>;
  videos: Video[];
}

async function readCache(): Promise<Snapshot | null> {
  try {
    return JSON.parse(await readFile(CACHE_FILE, 'utf8')) as Snapshot;
  } catch {
    return null;
  }
}

async function writeCache(snapshot: Snapshot): Promise<void> {
  try {
    await mkdir('.cache', { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify(snapshot, null, 2));
  } catch {
    /* cache is an optimisation; failing to write it is not fatal */
  }
}

/**
 * Resolve @handle -> channel ID by reading it out of the channel page.
 * YouTube exposes it in a canonical link and in embedded metadata.
 */
async function resolveChannelId(handle: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.youtube.com/@${handle}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; esrabot-web-build)' },
    });
    if (!res.ok) return null;

    const html = await res.text();
    const match = html.match(/"channelId":"(UC[\w-]{22})"/) ?? html.match(/channel\/(UC[\w-]{22})/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Minimal Atom parsing — the feed shape is fixed and small. */
function parseFeed(xml: string, orgId: string, orgName: string): Video[] {
  const channelTitle = xml.match(/<title>([^<]*)<\/title>/)?.[1] ?? orgName;
  const videos: Video[] = [];

  for (const entry of xml.split('<entry>').slice(1)) {
    const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    const title = entry.match(/<title>([^<]*)<\/title>/)?.[1];
    const published = entry.match(/<published>([^<]+)<\/published>/)?.[1];
    if (!id || !title || !published) continue;

    videos.push({
      id,
      title: title
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'"),
      url: `https://www.youtube.com/watch?v=${id}`,
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      published,
      channelTitle,
      orgId,
      orgName,
    });
  }

  return videos;
}

let memo: Promise<Video[]> | null = null;

/** Latest videos across every configured channel, newest first. */
export function getVideos(): Promise<Video[]> {
  memo ??= (async () => {
    const cached = await readCache();

    if (cached && Date.now() - cached.fetchedAt < TTL_MS && import.meta.env.DEV) {
      return cached.videos;
    }

    const channelIds: Record<string, string> = { ...(cached?.channelIds ?? {}) };
    const collected: Video[] = [];
    let anyFailed = false;

    for (const source of YOUTUBE_SOURCES) {
      let channelId = channelIds[source.handle];

      if (!channelId) {
        const resolved = await resolveChannelId(source.handle);
        if (!resolved) {
          console.warn(`[youtube] could not resolve @${source.handle}`);
          anyFailed = true;
          continue;
        }
        channelId = resolved;
        channelIds[source.handle] = channelId;
      }

      try {
        const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
        if (!res.ok) {
          anyFailed = true;
          continue;
        }
        collected.push(...parseFeed(await res.text(), source.orgId, source.orgName));
      } catch (err) {
        console.warn(`[youtube] ${source.handle}: ${(err as Error).message}`);
        anyFailed = true;
      }
    }

    if (collected.length === 0 && cached) {
      console.warn('[youtube] no videos fetched — serving last known good snapshot');
      return cached.videos;
    }

    collected.sort((a, b) => b.published.localeCompare(a.published));

    // Only overwrite the snapshot on a clean run, so a partial failure
    // doesn't quietly discard channels that worked last time.
    if (!anyFailed) {
      await writeCache({ fetchedAt: Date.now(), channelIds, videos: collected });
    }

    return collected;
  })();

  return memo;
}

/** Newest video per org — one tile each, rather than one channel dominating. */
export async function getLatestPerOrg(): Promise<Video[]> {
  const videos = await getVideos();
  const seen = new Set<string>();
  return videos.filter((v) => !seen.has(v.orgId) && seen.add(v.orgId));
}
