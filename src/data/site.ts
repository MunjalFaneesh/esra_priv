/**
 * Site-wide constants. Anything that would otherwise be hardcoded into a
 * template lives here.
 */

import { ESRA } from './orgs';

/**
 * Canonical origin. Mirrors the value in astro.config.mjs — that one feeds
 * the sitemap and RSS builders, this one is for runtime template use.
 */
export const SITE_URL = import.meta.env.SITE ?? process.env.SITE_URL ?? 'https://esra.bot';

export const SITE = {
  name: ESRA.name,
  fullName: ESRA.fullName,
  title: 'ESRA — Experimental Student Robotics Association',
  description: ESRA.blurb!,
  /** Used in the colophon and footer. */
  established: 'ICRA 2025',
  /** Legal status, from the incorporation record. */
  incorporated: 'New Jersey nonprofit, June 2026',
  license: 'MIT + CERN-OHL-S',
  repo: 'esrabot/web',
  repoUrl: 'https://github.com/esrabot/web',
  orgUrl: 'https://github.com/esrabot',
  /** GitHub Discussions category backing blog comments. */
  discussionsCategory: 'blog',
} as const;

/**
 * Contact addresses.
 *
 * These are real, monitored mailboxes on Zoho Mail (free plan for now).
 * They are the only email addresses that should appear anywhere on the
 * site — do not invent role addresses that no one is reading. Adding a new
 * mailbox is a one-line edit here once it exists in Zoho.
 *
 * Receive-only aliases (press@, join@, …) can be added later; see
 * docs/operations.md for why they must live in Zoho rather than Cloudflare
 * Email Routing while Zoho holds the domain's MX records.
 */
export const CONTACTS: { address: string; label: string; note: string }[] = [
  {
    address: 'info@esra.bot',
    label: 'General',
    note: 'Introductions, press, and anything that has no better home.',
  },
  {
    address: 'engineering@esra.bot',
    label: 'Engineering',
    note: 'Hardware, firmware, and questions about the open designs.',
  },
  {
    address: 'vibhu@esra.bot',
    label: 'Vibhu T. Gooty',
    note: 'Co-director. Partnerships and anything organisational.',
  },
];

/**
 * Primary navigation. `mono` renders the item in the monospace utility
 * style rather than as a normal nav link.
 */
export const NAV: { label: string; href: string; mono?: boolean }[] = [
  { label: 'Projects', href: '/projects' },
  { label: 'Blog', href: '/blog' },
  { label: 'Gallery', href: '/gallery' },
  { label: 'Guides', href: '/docs' },
  { label: 'Members', href: '/members' },
  { label: 'RSS', href: '/rss.xml', mono: true },
];

/**
 * Build provenance shown in the colophon. Vercel injects these; locally
 * they fall back to a dev marker rather than a fabricated hash.
 */
export function buildInfo() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? null;
  const ref = process.env.VERCEL_GIT_COMMIT_REF ?? process.env.GITHUB_REF_NAME ?? 'main';

  return {
    ref,
    sha: sha ? sha.slice(0, 6) : null,
    shaFull: sha,
    /** ISO date of this build. */
    date: new Date().toISOString().slice(0, 10),
    commitUrl: sha ? `${SITE.repoUrl}/commit/${sha}` : SITE.repoUrl,
  };
}
