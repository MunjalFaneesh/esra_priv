/**
 * Serves each partner's logo as a single-colour mark.
 *
 * The PNG is white with the logo's shape in its alpha channel, generated
 * at build time from whatever file the partner supplied. Pages never show
 * it directly: PartnerMark.astro uses it as a CSS mask and paints it in
 * the site's own ink. See src/lib/logo-mark.ts for how a logo is reduced.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';

import { getPartnerMark } from '../../lib/logo-mark';

export const getStaticPaths: GetStaticPaths = async () => {
  const partners = await getCollection('partners');
  return partners
    .filter((p) => p.data.logo)
    .map((p) => ({
      params: { id: p.id },
      props: { logo: p.data.logo, invert: p.data.logoInvert },
    }));
};

export const GET: APIRoute = async ({ props }) => {
  const { png } = await getPartnerMark(props.logo as string, { invert: props.invert as boolean });

  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png' },
  });
};
