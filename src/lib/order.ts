/**
 * Deterministic ordering helpers.
 *
 * The Members mockup shuffled the roster on every page load so nobody
 * held a permanent top slot. That intent is worth keeping, but a
 * per-load shuffle is a poor fit for a static site: it breaks the user's
 * ability to find someone twice, prevents a stable shareable order, and
 * needs client JS that reflows the list after paint.
 *
 * Instead the roster is shuffled once per *build*, seeded by the deploy
 * commit. Within a deploy the order is stable — no layout shift, no JS,
 * shareable — but it rotates on each deploy, so no one is permanently
 * first. Ordering is still non-preferential over time.
 *
 * To pin a fixed order instead, sort by the `order` frontmatter field
 * and drop the call to seededShuffle.
 */

/** Mulberry32 — small, fast, well-distributed PRNG for a 32-bit seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a: turns the commit SHA (or any string) into a numeric seed. */
function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * The per-build seed. Uses the deploy commit so the order is reproducible
 * for a given build, and changes when a new one ships. Falls back to a
 * constant locally so `pnpm dev` doesn't reshuffle on every reload.
 */
export function buildSeed(): string {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GITHUB_SHA ??
    'local-development-stable-seed'
  );
}

/** Fisher-Yates against a seeded PRNG. Returns a new array. */
export function seededShuffle<T>(items: readonly T[], seed: string = buildSeed()): T[] {
  const out = [...items];
  const rand = mulberry32(hashString(seed));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Zero-padded registry ID, e.g. M-001. */
export function memberCode(order: number): string {
  return `M-${String(order).padStart(3, '0')}`;
}

/** Initials for the avatar fallback plate. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
