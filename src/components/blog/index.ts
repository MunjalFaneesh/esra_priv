/**
 * The markdown authoring vocabulary.
 *
 * Every component here is injected into MDX automatically by the post and
 * docs layouts, so an author writes `<Fig …/>` or `<BOM …/>` with no
 * import line and no knowledge of where the component lives. Adding a
 * component to this map is all it takes to make it available site-wide.
 *
 * Plain .md keeps working untouched — this vocabulary is opt-in, and only
 * .mdx files can use it.
 */
import Fig from './Fig.astro';
import Video from './Video.astro';
import Embed from './Embed.astro';
import Callout from './Callout.astro';
import MarginNote from './MarginNote.astro';
import BOM from './BOM.astro';
import Repo from './Repo.astro';
import Spec from './Spec.astro';
import Eq from './Eq.astro';
import LinkedInPost from './LinkedInPost.astro';

export const mdxComponents = {
  Fig,
  Figure: Fig,
  Video,
  Embed,
  Callout,
  Note: Callout,
  MarginNote,
  Side: MarginNote,
  BOM,
  Repo,
  Spec,
  Eq,
  LinkedInPost,
};

export type MdxComponents = typeof mdxComponents;
