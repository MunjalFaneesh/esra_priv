/**
 * Remark plugin: counts words in a post body and exposes the figure on
 * the frontmatter, so layouts can show a reading estimate.
 *
 * Done at build time from the parsed AST rather than in a component,
 * because the rendered component tree no longer has the raw prose.
 */
import { toString } from 'mdast-util-to-string';

export function remarkWordCount() {
  return (tree, file) => {
    const text = toString(tree);
    const words = text.split(/\s+/).filter(Boolean).length;
    file.data.astro.frontmatter.wordCount = words;
  };
}
