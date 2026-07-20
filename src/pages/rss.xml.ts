/**
 * The site-wide feed. Every published post, newest first, with media
 * enclosures derived automatically — see lib/feed.ts.
 */
import type { APIRoute } from 'astro';
import { buildFeed } from '../lib/feed';

export const GET: APIRoute = ({ site }) => buildFeed({ site: site!.href });
