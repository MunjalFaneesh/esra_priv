#!/usr/bin/env node
/**
 * Content validation with human-readable errors.
 *
 * Astro already validates frontmatter against the Zod schemas at build
 * time, but a raw Zod failure is close to unreadable if you have never
 * seen one. This runs first and reports the same problems in plain
 * English, naming the file, the field, and what to do about it — so a
 * contributor who has only ever written markdown can fix their own post
 * from the CI log without asking anyone.
 *
 * Run: pnpm validate:content
 */

import { readdir, readFile, access } from 'node:fs/promises';
import { join, extname, dirname, resolve, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';

import { RESERVED_ROUTES } from '../src/lib/reserved-routes.mjs';

const problems = [];
const notes = [];

function fail(file, message, hint) {
  problems.push({ file, message, hint });
}

/** Split a markdown file into frontmatter and body. */
function splitFrontmatter(raw) {
  if (!raw.startsWith('---')) return { frontmatter: null, body: raw };
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return { frontmatter: null, body: raw };
  return {
    frontmatter: raw.slice(3, end),
    body: raw.slice(end + 4),
  };
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(dir, exts) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const out = [];
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) out.push(...(await listFiles(path, exts)));
      else if (exts.includes(extname(entry.name))) out.push(path);
    }
    return out;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------
// Members — needed first, because posts reference them by ID.
// ---------------------------------------------------------------------
const memberFiles = await listFiles('src/content/members', ['.md', '.mdx']);
const memberIds = new Set(
  memberFiles.map((f) =>
    f
      .split('/')
      .pop()
      .replace(/\.mdx?$/, '')
  )
);

/** slug -> file, so a collision can name both sides. */
const memberSlugs = new Map();

for (const file of memberFiles) {
  const raw = await readFile(file, 'utf8');
  const { frontmatter } = splitFrontmatter(raw);

  if (!frontmatter) {
    fail(file, 'has no frontmatter block', 'Start the file with a --- line.');
    continue;
  }

  let data;
  try {
    data = parseYaml(frontmatter);
  } catch (err) {
    fail(file, `frontmatter is not valid YAML — ${err.message}`, yamlHint(err));
    continue;
  }

  if (!data?.name) {
    fail(file, 'is missing `name`', 'Add a line like:  name: Jane Doe');
  }

  for (const link of data?.links ?? []) {
    if (!link?.url) {
      fail(file, 'has a link with no `url`', 'Every entry under `links:` needs a url.');
    }
  }

  if (data?.avatar) {
    const target = resolve(dirname(file), data.avatar);
    if (!(await exists(target))) {
      fail(
        file,
        `\`avatar\` points at a file that does not exist: ${data.avatar}`,
        `Expected to find: ${relative(process.cwd(), target)}`
      );
    }
  }

  // Member pages are served from the site root (esra.bot/willcforte), so a
  // slug shares a namespace with every real route. Catch clashes here,
  // where the message can explain the problem.
  const slug =
    data?.handle ??
    file
      .split('/')
      .pop()
      .replace(/\.mdx?$/, '');

  if (RESERVED_ROUTES.has(slug.toLowerCase())) {
    fail(
      file,
      `uses the URL slug "${slug}", which is a reserved site route`,
      `Member pages live at the site root, so /${slug} is already taken.\n` +
        'Add a different `handle:` to the frontmatter, e.g.  handle: your-name'
    );
  }

  if (data?.handle && !/^[a-z0-9][a-z0-9-]*$/.test(data.handle)) {
    fail(
      file,
      `has an invalid \`handle\`: "${data.handle}"`,
      'Use lowercase letters, numbers and hyphens only, e.g.  handle: willcforte'
    );
  }

  const clash = memberSlugs.get(slug);
  if (clash) {
    fail(
      file,
      `resolves to the same URL as ${clash}: /${slug}`,
      'Two members cannot share a slug. Set a distinct `handle:` on one of them.'
    );
  }
  memberSlugs.set(slug, file);
}

// ---------------------------------------------------------------------
// Blog posts
// ---------------------------------------------------------------------
const postFiles = await listFiles('src/content/blog', ['.md', '.mdx']);

for (const file of postFiles) {
  const raw = await readFile(file, 'utf8');
  const { frontmatter, body } = splitFrontmatter(raw);

  if (!frontmatter) {
    fail(
      file,
      'has no frontmatter block',
      'A post must begin with --- , then title/date/authors, then another ---.'
    );
    continue;
  }

  let data;
  try {
    data = parseYaml(frontmatter);
  } catch (err) {
    fail(file, `frontmatter is not valid YAML — ${err.message}`, yamlHint(err));
    continue;
  }

  if (!data?.title) {
    fail(file, 'is missing `title`', 'Add a line like:  title: My post');
  }

  if (!data?.date) {
    fail(file, 'is missing `date`', 'Add a line like:  date: 2026-07-20');
  } else if (Number.isNaN(new Date(data.date).getTime())) {
    fail(
      file,
      `\`date\` is not a date I can read: ${data.date}`,
      'Use YYYY-MM-DD, for example:  date: 2026-07-20'
    );
  }

  if (!data?.authors || !Array.isArray(data.authors) || data.authors.length === 0) {
    fail(
      file,
      'is missing `authors`',
      'Add the author id (the members filename without .md), e.g.\n' +
        '    authors:\n      - will-forte'
    );
  } else {
    for (const id of data.authors) {
      if (!memberIds.has(id)) {
        const known = [...memberIds].sort().join(', ');
        fail(
          file,
          `lists an unknown author: "${id}"`,
          `Author ids are filenames in src/content/members/.\nKnown ids: ${known}`
        );
      }
    }
  }

  if (data?.cover) {
    const target = resolve(dirname(file), data.cover);
    if (!(await exists(target))) {
      fail(
        file,
        `\`cover\` points at a file that does not exist: ${data.cover}`,
        `Expected to find: ${relative(process.cwd(), target)}\n` +
          'Put the image in src/assets/blog/ and reference it as ../../assets/blog/<name>'
      );
    }
    if (!data.coverAlt) {
      notes.push(
        `${file}: has a cover image but no \`coverAlt\`. ` +
          'Add one so screen-reader users know what it shows.'
      );
    }
  }

  // Obsidian-style wikilinks silently render as literal text. One shipped
  // broken on the old site for months, so it is an error here.
  const wikilink = body.match(/!\[\[([^\]]+)\]\]/);
  if (wikilink) {
    fail(
      file,
      `contains an Obsidian wikilink that will not render: ![[${wikilink[1]}]]`,
      `Use standard markdown instead:\n    ![description](../../assets/blog/${wikilink[1]})`
    );
  }

  // Body image paths must resolve.
  for (const [, alt, src] of body.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
    if (/^(https?:)?\/\//.test(src) || src.startsWith('/')) continue;
    const target = resolve(dirname(file), src);
    if (!(await exists(target))) {
      fail(
        file,
        `references an image that does not exist: ${src}`,
        `Expected to find: ${relative(process.cwd(), target)}`
      );
    }
    if (!alt.trim()) {
      notes.push(`${file}: image "${src}" has no alt text.`);
    }
  }
}

// ---------------------------------------------------------------------
// YAML data files
// ---------------------------------------------------------------------
for (const file of ['src/content/gallery.yaml', 'src/content/partners.yaml']) {
  if (!(await exists(file))) continue;
  try {
    const rows = parseYaml(await readFile(file, 'utf8'));
    if (!Array.isArray(rows)) {
      fail(file, 'should be a list of entries', 'Each entry starts with "- id: ..."');
      continue;
    }
    const seen = new Set();
    for (const row of rows) {
      if (!row?.id) {
        fail(file, 'has an entry with no `id`', 'Every entry needs a unique id.');
        continue;
      }
      if (seen.has(row.id)) {
        fail(file, `has two entries with the id "${row.id}"`, 'Ids must be unique.');
      }
      seen.add(row.id);
    }
  } catch (err) {
    fail(file, `is not valid YAML — ${err.message}`, yamlHint(err));
  }
}

// ---------------------------------------------------------------------
// BOMs
// ---------------------------------------------------------------------
for (const file of await listFiles('src/content/boms', ['.yaml', '.yml'])) {
  try {
    const data = parseYaml(await readFile(file, 'utf8'));
    if (!data?.title) fail(file, 'is missing `title`', 'Add a title for the BOM.');
    if (!Array.isArray(data?.lines)) {
      fail(file, 'is missing `lines`', 'A BOM needs a `lines:` list of parts.');
    } else {
      data.lines.forEach((line, i) => {
        if (!line?.item) {
          fail(file, `line ${i + 1} has no \`item\``, 'Every line needs an item name.');
        }
      });
    }
  } catch (err) {
    fail(file, `is not valid YAML — ${err.message}`, yamlHint(err));
  }
}

/** The YAML mistake people actually make, called out specifically. */
function yamlHint(err) {
  if (/mapping/i.test(err.message)) {
    return (
      'This usually means a value contains a colon followed by a space.\n' +
      'Wrap the whole value in quotes, e.g.\n' +
      '    credits: "Built by CCBR. Photo: Ryan Rudes."'
    );
  }
  return 'Check indentation — YAML uses spaces, never tabs.';
}

// ---------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------
if (notes.length > 0) {
  console.log('\nSuggestions (these do not fail the build):\n');
  for (const note of notes) console.log(`  · ${note}`);
}

if (problems.length === 0) {
  const total = postFiles.length + memberFiles.length;
  console.log(`\nContent OK — ${postFiles.length} posts, ${memberFiles.length} members checked.\n`);
  process.exit(0);
}

console.error(`\n${problems.length} problem(s) found in content:\n`);
for (const { file, message, hint } of problems) {
  console.error(`  ${file}`);
  console.error(`    ${message}`);
  if (hint) {
    for (const line of hint.split('\n')) console.error(`    ${line}`);
  }
  console.error('');
}
console.error('Fix the files above and commit again. Nothing else needs to change.\n');
process.exit(1);
