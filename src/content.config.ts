import { defineCollection, reference, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

/**
 * Content collections.
 *
 * These schemas are the contract for anyone adding content. They are
 * intentionally forgiving where a contributor might reasonably vary
 * (dates as strings, a single author or a list) and strict where a
 * mistake would ship broken — an unknown author ID or a missing image
 * fails the build with a named error rather than rendering an empty slot.
 *
 * Ported from the old Nuxt site's schema/*.ts, with the fixes noted below.
 */

/** Media reference used by figures, gallery items, and RSS enclosures. */
const media = z.object({
  type: z.enum(['image', 'video', 'audio', 'embed']).default('image'),
  src: z.string(),
  alt: z.string().optional(),
  /** Poster frame for video. */
  poster: z.string().optional(),
  /** Attribution — a real editorial convention carried over from the old site. */
  credits: z.string().optional(),
  caption: z.string().optional(),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().optional(),
      /** Coerced, so `2025-09-04` and `Sept 4 2025` both work. */
      date: z.coerce.date(),
      updated: z.coerce.date().optional(),

      /**
       * Authors are member IDs, validated against the members collection.
       * The old site matched authors by exact display string, so a post
       * saying "Will Forte" instead of "Will C. Forte" silently lost its
       * byline. A bad ID now fails the build instead.
       */
      authors: z.array(reference('members')).min(1),

      category: z.string().optional(),
      tags: z.array(z.string()).default([]),

      /** Feeds the card, the OG image, and the RSS enclosure. */
      cover: image().optional(),
      coverAlt: z.string().optional(),

      /**
       * Extra media surfaced in the feed (a video walkthrough, an audio
       * note). The RSS builder picks the right enclosure type per item.
       */
      media: z.array(media).default([]),

      /** Which org this post belongs to; drives per-org sub-feeds. */
      org: z.enum(['esra', 'rutgers-dynamics']).default('esra'),

      draft: z.boolean().default(false),
      /** Pins to the top of the index. */
      featured: z.boolean().default(false),

      seo: z
        .object({
          title: z.string().optional(),
          description: z.string().optional(),
        })
        .optional(),
    }),
});

const members = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/members' }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      /** Sort key and stable ID; the filename is the slug. */
      order: z.number().default(100),

      /** Discipline, e.g. "Mechanical" / "Software". */
      discipline: z.string().optional(),

      /**
       * Roles across organisations. Modelled as a list because several
       * people hold positions in more than one org (co-president of
       * Rutgers Dynamics AND co-director of ESRA).
       */
      roles: z
        .array(
          z.object({
            org: z.string(),
            title: z.string().optional(),
          })
        )
        .default([]),

      /** Free-text school/club line shown under the name. */
      affiliation: z.string().optional(),

      avatar: image().optional(),
      pronouns: z.string().optional(),

      links: z
        .array(
          z.object({
            platform: z.enum([
              'website',
              'github',
              'linkedin',
              'youtube',
              'instagram',
              'x',
              'bluesky',
              'email',
              'linktree',
            ]),
            handle: z.string().optional(),
            url: z.string(),
          })
        )
        .default([]),

      /** Hide from the roster without deleting the record. */
      inactive: z.boolean().default(false),
    }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      summary: z.string(),
      /**
       * `owner/name` on GitHub. When set, stars, language, last commit,
       * and topics are fetched at build time — never hand-maintained.
       */
      repo: z.string().optional(),
      status: z.enum(['active', 'prototype', 'shipped', 'archived']).default('active'),
      /** Discipline tags: cad, pcb, firmware, rl, sim, web. */
      domains: z.array(z.string()).default([]),
      cover: image().optional(),
      /** Hardware revision, e.g. "rev D". */
      revision: z.string().optional(),
      links: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
      /** Bill of materials, by BOM collection ID. */
      bom: reference('boms').optional(),
      order: z.number().default(100),
      draft: z.boolean().default(false),
    }),
});

/**
 * Gallery and partners are flat YAML lists rather than a file per entry:
 * they are short records that read better as one editable table, and the
 * `file()` loader parses a top-level array natively as long as each row
 * carries an `id`.
 */
const gallery = defineCollection({
  loader: file('./src/content/gallery.yaml'),
  schema: z.object({
    type: z.enum(['image', 'video']).default('image'),
    title: z.string(),
    date: z.coerce.date(),
    src: z.string(),
    poster: z.string().optional(),
    description: z.string().optional(),
    /** Preserved verbatim from the old site — attribution matters here. */
    credits: z.string().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).default([]),
    alt: z.string().optional(),
  }),
});

const partners = defineCollection({
  loader: file('./src/content/partners.yaml'),
  schema: z.object({
    name: z.string(),
    /** Club abbreviation, e.g. CRT, CURC, RMC. */
    abbr: z.string().optional(),
    school: z.string(),
    location: z.string().optional(),
    url: z.string(),
    /** Path under src/assets/logos. Absent for clubs with no logo yet. */
    logo: z.string().optional(),
  }),
});

/**
 * Bills of materials. A first-class content type because open hardware is
 * only reproducible if the parts list is published with the design.
 */
const boms = defineCollection({
  loader: glob({ pattern: '**/*.{yaml,yml,json}', base: './src/content/boms' }),
  schema: z.object({
    title: z.string(),
    /** What this BOM builds. */
    subject: z.string().optional(),
    updated: z.coerce.date().optional(),
    currency: z.string().default('USD'),
    notes: z.string().optional(),
    lines: z.array(
      z.object({
        vendor: z.string().optional(),
        item: z.string(),
        /** Free text: quantities here are often expressions ("9 x 3 = 27"). */
        qty: z.union([z.string(), z.number()]).optional(),
        unitPrice: z.number().optional(),
        unitQty: z.number().optional(),
        notes: z.string().optional(),
        purchased: z.boolean().default(false),
        /** Product page, datasheet, CAD model, etc. */
        links: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
      })
    ),
  }),
});

const docs = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/docs' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    order: z.number().default(100),
    /** Estimated reading/working time, e.g. "14 min". */
    duration: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog, members, projects, gallery, partners, boms, docs };
