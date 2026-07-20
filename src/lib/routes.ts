/**
 * Route reservation.
 *
 * Member pages publish at the site root (esra.bot/willcforte), which means
 * a member slug shares a namespace with every real route. If someone ever
 * took the slug `blog`, their page and the blog index would fight over the
 * same URL and one would silently win.
 *
 * The list itself lives in reserved-routes.mjs so the Node validation
 * script can import the same data the build uses.
 */
export { RESERVED_ROUTES } from './reserved-routes.mjs';

import { RESERVED_ROUTES as RESERVED } from './reserved-routes.mjs';

/** The published URL slug for a member entry. */
export function memberSlug(entry: { id: string; data: { handle?: string } }): string {
  return entry.data.handle ?? entry.id;
}

/** Absolute path for a member's page. */
export function memberPath(entry: { id: string; data: { handle?: string } }): string {
  return `/${memberSlug(entry)}`;
}

export function isReserved(slug: string): boolean {
  return RESERVED.has(slug.toLowerCase());
}
