/**
 * Feed builder shared by /rss.xml and the per-org feeds.
 *
 * Emits RSS 2.0 plus the Media RSS namespace, so readers and social
 * unfurlers get a usable representation of images, video, and embeds
 * rather than only a text summary.
 */
import rss, { type RSSFeedItem } from '@astrojs/rss';
import { getCollection, getEntry, type CollectionEntry } from 'astro:content';

import { SITE } from '../data/site';
import { imageEnclosure, publicFileEnclosure, embedMedia, type FeedMedia } from './feed-media';

/** Escape text destined for an XML attribute or node. */
function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Work out every media representation a post should advertise.
 *
 * Order matters: the cover image is the primary enclosure (RSS 2.0 allows
 * only one <enclosure> per item), and everything else is expressed with
 * <media:content>, which permits many.
 */
async function mediaFor(
  post: CollectionEntry<'blog'>,
  site: string
): Promise<{ primary: FeedMedia | null; extra: FeedMedia[] }> {
  const extra: FeedMedia[] = [];

  const primary = post.data.cover ? await imageEnclosure(post.data.cover, post.id, site) : null;

  for (const item of post.data.media) {
    if (item.type === 'embed') {
      const embed = embedMedia(item.src);
      if (embed) extra.push(embed);
      continue;
    }

    // Anything under public/ (video, audio) is served as-is.
    if (item.src.startsWith('/')) {
      const file = await publicFileEnclosure(item.src, site);
      if (file) extra.push(file);
    }
  }

  return { primary, extra };
}

/** Render the Media RSS block for one item. */
function mediaXml(primary: FeedMedia | null, extra: FeedMedia[]): string {
  const parts: string[] = [];

  if (primary) {
    parts.push(
      `<media:content url="${xml(primary.url)}" type="${primary.mime}" medium="image"` +
        ` fileSize="${primary.length}"` +
        (primary.width ? ` width="${primary.width}"` : '') +
        (primary.height ? ` height="${primary.height}"` : '') +
        ` />`,
      `<media:thumbnail url="${xml(primary.url)}" />`
    );
  }

  for (const m of extra) {
    if (m.player) {
      parts.push(`<media:player url="${xml(m.player)}" />`);
      if (m.thumbnail) parts.push(`<media:thumbnail url="${xml(m.thumbnail)}" />`);
      continue;
    }
    parts.push(
      `<media:content url="${xml(m.url)}" type="${m.mime}" medium="${m.medium}"` +
        ` fileSize="${m.length}" />`
    );
  }

  return parts.join('');
}

interface FeedOptions {
  site: string;
  /** Restrict to one org's posts. */
  org?: string;
  title?: string;
  description?: string;
}

export async function buildFeed({ site, org, title, description }: FeedOptions) {
  const posts = (await getCollection('blog'))
    .filter((p) => !p.data.draft)
    .filter((p) => !org || p.data.org === org)
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

  const items: RSSFeedItem[] = await Promise.all(
    posts.map(async (post) => {
      const { primary, extra } = await mediaFor(post, site);

      const authors = await Promise.all(post.data.authors.map((ref) => getEntry(ref)));
      const byline = authors.map((a) => a!.data.name).join(', ');

      return {
        title: post.data.title,
        description: post.data.description ?? '',
        pubDate: post.data.date,
        link: `/blog/${post.id}`,
        categories: post.data.tags,
        author: byline,
        // Only a real, measured enclosure is ever emitted.
        ...(primary
          ? { enclosure: { url: primary.url, type: primary.mime, length: primary.length } }
          : {}),
        customData: `<dc:creator>${xml(byline)}</dc:creator>` + mediaXml(primary, extra),
      };
    })
  );

  return rss({
    title: title ?? `${SITE.name} — build log`,
    description: description ?? SITE.description,
    site,
    items,
    xmlns: {
      media: 'http://search.yahoo.com/mrss/',
      dc: 'http://purl.org/dc/elements/1.1/',
      atom: 'http://www.w3.org/2005/Atom',
    },
    customData: [
      `<language>en-us</language>`,
      `<generator>Astro</generator>`,
      `<atom:link href="${xml(new URL('/rss.xml', site).href)}" rel="self" type="application/rss+xml" />`,
    ].join(''),
    trailingSlash: false,
  });
}
