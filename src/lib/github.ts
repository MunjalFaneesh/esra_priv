/**
 * GitHub data, fetched at build time.
 *
 * Three properties matter here:
 *
 *  1. It never fabricates. If the API is unreachable, the site falls back
 *     to the last successful snapshot committed under .cache/, and if
 *     there is no snapshot either, callers get null and render without
 *     the stats rather than with invented ones.
 *
 *  2. It never fails the build. A rate limit or an outage during a cron
 *     rebuild must not take the site down.
 *
 *  3. It is cached on disk, so `pnpm dev` doesn't burn the unauthenticated
 *     rate limit (60/hour) on every reload.
 *
 * Set GITHUB_TOKEN in CI for the 5,000/hour authenticated limit and to
 * include private repos the org wants surfaced.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const CACHE_DIR = '.cache';
const CACHE_FILE = join(CACHE_DIR, 'github.json');

/** How long a cached snapshot is considered fresh during local dev. */
const TTL_MS = 1000 * 60 * 60 * 6;

export interface RepoInfo {
  fullName: string;
  name: string;
  description: string | null;
  url: string;
  homepage: string | null;
  stars: number;
  forks: number;
  language: string | null;
  topics: string[];
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
  pushedAt: string | null;
  /** Short SHA of the default branch head, when available. */
  headSha: string | null;
  defaultBranch: string;
}

interface Snapshot {
  fetchedAt: number;
  repos: RepoInfo[];
}

const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;

async function api<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`https://api.github.com${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'esrabot-web-build',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) {
      console.warn(`[github] ${path} -> ${res.status} ${res.statusText}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[github] ${path} -> ${(err as Error).message}`);
    return null;
  }
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
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify(snapshot, null, 2));
  } catch (err) {
    console.warn(`[github] could not write cache: ${(err as Error).message}`);
  }
}

interface RawRepo {
  full_name: string;
  name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  topics?: string[];
  private: boolean;
  fork: boolean;
  archived: boolean;
  pushed_at: string | null;
  default_branch: string;
}

function normalise(raw: RawRepo): RepoInfo {
  return {
    fullName: raw.full_name,
    name: raw.name,
    description: raw.description,
    url: raw.html_url,
    homepage: raw.homepage,
    stars: raw.stargazers_count,
    forks: raw.forks_count,
    language: raw.language,
    topics: raw.topics ?? [],
    isPrivate: raw.private,
    isFork: raw.fork,
    isArchived: raw.archived,
    pushedAt: raw.pushed_at,
    headSha: null,
    defaultBranch: raw.default_branch,
  };
}

let memo: Promise<RepoInfo[]> | null = null;

/**
 * All repos for the org. Memoised per build so a page rendering many
 * repo cards issues one request, not many.
 */
export function getOrgRepos(org = 'esrabot'): Promise<RepoInfo[]> {
  memo ??= (async () => {
    const cached = await readCache();

    // In dev, serve a fresh-enough cache without touching the network.
    if (cached && Date.now() - cached.fetchedAt < TTL_MS && import.meta.env.DEV) {
      return cached.repos;
    }

    const raw = await api<RawRepo[]>(`/orgs/${org}/repos?per_page=100&sort=pushed`);

    if (!raw) {
      if (cached) {
        console.warn('[github] request failed — serving last known good snapshot');
        return cached.repos;
      }
      console.warn('[github] request failed and no cache — repo data omitted');
      return [];
    }

    const repos = raw.map(normalise);
    await writeCache({ fetchedAt: Date.now(), repos });
    return repos;
  })();

  return memo;
}

/** One repo by `owner/name`, or by bare name within the default org. */
export async function getRepo(nameOrFullName: string): Promise<RepoInfo | null> {
  const full = nameOrFullName.includes('/') ? nameOrFullName : `esrabot/${nameOrFullName}`;
  const all = await getOrgRepos(full.split('/')[0]);
  return all.find((r) => r.fullName.toLowerCase() === full.toLowerCase()) ?? null;
}

/**
 * Public, non-fork repos, most recently pushed first — the set worth
 * showing on a projects page.
 */
export async function getPublicRepos(org = 'esrabot'): Promise<RepoInfo[]> {
  const all = await getOrgRepos(org);
  return all
    .filter((r) => !r.isPrivate && !r.isFork && !r.isArchived)
    .sort((a, b) => (b.pushedAt ?? '').localeCompare(a.pushedAt ?? ''));
}

/** "3 weeks ago" style relative time, for repo freshness. */
export function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const days = Math.floor((Date.now() - then) / 86_400_000);

  if (days < 1) return 'today';
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}
