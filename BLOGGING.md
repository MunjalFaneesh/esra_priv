# Writing for the site

You do not need to install anything, and you do not need to know web
development. A blog post is one text file. If you can edit a file on
GitHub, you can publish.

---

## The short version

1. Go to [`src/content/blog`](https://github.com/esrabot/web/tree/main/src/content/blog)
2. Click **Add file → Create new file**
3. Name it `my-post-title.md` (lowercase, hyphens, ending in `.md`)
4. Paste the template below and write
5. Click **Propose new file**

A robot checks your file and posts a link to a preview of the live page.
When someone approves it, it publishes automatically.

The filename becomes the web address: `my-post-title.md` → `esra.bot/blog/my-post-title`.

---

## Template

Copy this whole block. The part between the `---` lines is the post's
information; everything after is what people read.

```markdown
---
title: What I did and what broke
description: One or two sentences. Shown on the blog index and in the RSS feed.
date: 2026-07-20
authors:
  - your-id-here
tags:
  - hardware
---

## Start with a heading

Then write normally. **Bold** and _italic_ work. So do links:
[like this](https://example.com).

- Bullet points
- Work the way you expect
```

### The fields

| Field         | Needed? | Notes                                                                                                           |
| ------------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `title`       | yes     | Plain text                                                                                                      |
| `date`        | yes     | `YYYY-MM-DD`, e.g. `2026-07-20`                                                                                 |
| `authors`     | yes     | Your **id** — the filename of your entry in `src/content/members` without `.md`. Will C. Forte is `will-forte`. |
| `description` | no      | Strongly recommended — it's what people see before they click                                                   |
| `tags`        | no      | Lowercase, a few is plenty                                                                                      |
| `category`    | no      | e.g. `Announcement`                                                                                             |
| `cover`       | no      | See below                                                                                                       |
| `draft`       | no      | `true` keeps it unpublished                                                                                     |

> **If you're not in the members list yet**, add yourself first — see
> [CONTRIBUTING.md](./CONTRIBUTING.md). Posts fail the check if the author
> id doesn't exist, which is deliberate: it means a byline never silently
> disappears.

---

## Adding pictures

Put the image in `src/assets/blog/`, then reference it:

```markdown
![A short description of what the photo shows](../../assets/blog/my-photo.jpg)
```

Two things worth knowing:

- **Don't resize anything first.** Upload the photo straight off your
  phone or camera. The site resizes and compresses automatically, and
  keeping the original means we can re-crop later.
- **Always write the description** (the text in the square brackets). It's
  what a blind reader hears in place of the image, and it's the one thing
  the tooling can't do for you.

To use an image as the post's headline picture, add it to the frontmatter
instead:

```yaml
cover: ../../assets/blog/my-photo.jpg
coverAlt: A short description of what the photo shows.
```

The cover is also what shows up when the post is shared on social media
and in the RSS feed.

---

## Richer posts

Rename your file from `.md` to `.mdx` and you can use the site's building
blocks. **You never import anything** — just use them.

### A figure with a caption

```mdx
<Fig
  src="gallery/leg-test-stand.jpg"
  alt="The leg test stand assembled on a linear slide."
  plate="FIG.1 — TEST STAND"
  caption="**Figure 1.** Designed by Luis Serrano Laguna."
/>
```

Add `margin` to float it into the side column: `<Fig margin src="..." />`

### A note or warning

```mdx
<Callout kind="warn" title="Mind the enamel">
  Over-tensioning nicks the wire and shorts a turn.
</Callout>
```

`kind` can be `note`, `warn`, or `spec`.

### A side note in the margin

```mdx
<MarginNote n="1">
  A gear ratio near N = 6 keeps reflected inertia low.
</MarginNote>
```

### Video

```mdx
<Video src="/media/running-leg.mp4" caption="Leg integration test." />
```

For YouTube, use `<Embed youtube="VIDEO_ID" />`. Nothing loads from
YouTube until a reader presses play.

### A repository, with live stats

```mdx
<Repo name="esrabot/CCBR-Leg-Test" />
```

Stars and last-updated are fetched automatically. Never type them in —
they'd be wrong within a week.

### A specification table

```mdx
<Spec
  items={[
    ['Stator', '8110'],
    ['Winding', '26 AWG enamelled copper'],
  ]}
/>
```

### A bill of materials

Put the parts list in `src/content/boms/my-thing.yaml`, then:

```mdx
<BOM id="my-thing" />
```

See [`src/content/boms/leg-test-stand.yaml`](./src/content/boms/leg-test-stand.yaml)
for a worked example, and
[the page it produces](https://esra.bot/docs/leg-test-stand).

---

## If the check fails

The automated check writes plain English. For example:

```
src/content/blog/my-post.md
  lists an unknown author: "will"
  Author ids are filenames in src/content/members/.
  Known ids: alex-tong, donny-lu, gonzalo-ramos, ..., will-forte
```

Fix the file and commit again — nothing else needs doing. Common causes:

- **Date not recognised** — use `2026-07-20`, not `July 20`.
- **Unknown author** — use the filename id, not your display name.
- **Image not found** — check the path and the file extension's spelling.
- **YAML error about "mapping"** — a value contains a colon followed by a
  space. Wrap the whole value in quotes:
  `credits: "Built by CCBR. Photo: Ryan Rudes."`

---

## Prefer a visual editor?

There's one at [esra.bot/admin](https://esra.bot/admin) — same files, same
result, with an upload button and a preview. Either route is fine, and you
can switch between them freely.

You sign in with GitHub, so your post arrives as a pull request from your
own account, exactly as if you'd added the file by hand. Someone reviews it
and merges. You'll need to be a member of the `esrabot` organization first.

Setting it up (a one-time job, already done or documented in
[docs/cms-setup.md](docs/cms-setup.md)) is not something you need to read.

---

## Working locally (optional)

If you'd rather see changes as you type:

```bash
pnpm install
pnpm dev          # then open http://localhost:4321
```

Before pushing:

```bash
pnpm validate:content   # the same check CI runs
```
