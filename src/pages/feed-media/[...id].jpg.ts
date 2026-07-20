/**
 * Serves the feed-sized image derivative for each post.
 *
 * The RSS enclosure needs a stable URL with a byte length that matches
 * exactly what a reader will download, so the derivative is generated at
 * build time here and the feed reports this file's real size.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';

import { readFeedDerivative } from '../../lib/feed-media';

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getCollection('blog');
  return posts
    .filter((post) => !post.data.draft && post.data.cover)
    .map((post) => ({ params: { id: post.id }, props: { post } }));
};

export const GET: APIRoute = async ({ props }) => {
  const post = props.post as Awaited<ReturnType<typeof getCollection<'blog'>>>[number];
  const buffer = post.data.cover ? await readFeedDerivative(post.data.cover) : null;

  if (!buffer) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
