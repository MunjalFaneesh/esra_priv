# Contributing

Everything on this site is a file in this repository. There is no CMS you
have to learn and no permission you have to ask for — open a pull request
and it gets reviewed.

For writing posts specifically, see **[BLOGGING.md](./BLOGGING.md)**.

---

## Adding yourself to Members

Create `src/content/members/your-name.md`. The filename is your **id** —
lowercase, hyphenated — and it's what posts use to credit you.

```markdown
---
name: Your Name
order: 11
discipline: Mechanical
affiliation: Rutgers Dynamics
avatar: ../../assets/avatars/your-name.jpg
roles:
  - org: esra
links:
  - platform: github
    handle: yourhandle
    url: https://github.com/yourhandle
  - platform: linkedin
    handle: in/yourhandle
    url: https://www.linkedin.com/in/yourhandle/
---

One or two sentences about what you work on.
```

Notes:

- **Everything except `name` is optional.** A member with no links and no
  photo renders fine.
- Put your photo in `src/assets/avatars/`. Any size — it gets resized.
- `platform` must be one of: `website`, `github`, `linkedin`, `youtube`,
  `instagram`, `x`, `bluesky`, `email`, `linktree`.
- If you hold an officer role, add a `title`:
  ```yaml
  roles:
    - org: rutgers-dynamics
      title: Co-president
  ```

**Please write your own bio.** The ones currently in the repo are
deliberately minimal — limited strictly to what could be verified from the
old site — precisely so that nobody is described with invented detail.
Replace yours with something true.

---

## Adding a project

`src/content/projects/my-project.md`:

```markdown
---
title: My Project
summary: One or two sentences.
repo: esrabot/my-repo # optional
status: prototype # active | prototype | shipped | archived
domains: [cad, firmware]
---

Longer description. Supports everything in BLOGGING.md.
```

If you set `repo`, stars and last-updated come from GitHub automatically —
don't type them in. If you leave it out, the project still gets a page;
it just won't show repository statistics.

Repos in the `esrabot` org appear on `/projects` **automatically**. You
only need a file here to add detail or to describe work with no repo.

---

## Adding a gallery item

Add the file to `src/assets/gallery/` (or `public/media/` for video), then
add an entry to `src/content/gallery.yaml`:

```yaml
- id: my-photo
  type: image
  title: What it shows
  date: 2026-07-20
  src: gallery/my-photo.jpg
  alt: A description for screen-reader users.
  category: Hardware
  tags: [leg]
  credits: 'Designed by A. Person. Photo: B. Person.'
```

**Please fill in `credits`.** Recording who designed, built, and
photographed something is a convention this project has kept from the
start, and it matters — several parts were designed by people outside the
core team.

Note the quotes around `credits`: any value containing a colon followed by
a space must be quoted, or YAML misreads it.

---

## Adding a bill of materials

Open hardware is only reproducible if the parts list ships with it. Put
one in `src/content/boms/my-thing.yaml` and render it in any page with
`<BOM id="my-thing" />`.

```yaml
title: My Thing — BOM
subject: What this builds
currency: USD
lines:
  - vendor: Amazon
    item: SBR20 linear rail, 800 mm
    qty: 2
    unitPrice: 42.64
    unitQty: 1
    purchased: true
    links:
      - label: CAD (GrabCAD)
        url: https://grabcad.com/...
```

Only `item` is required per line. Leave a price out rather than guessing —
the component reports how many lines are unpriced instead of quietly
understating the total.

---

## Changing how the site looks

Colours, spacing, and type are all in
[`src/styles/tokens.css`](./src/styles/tokens.css). Change them there, not
in a component.

If you change a text or surface colour, run:

```bash
pnpm check:contrast
```

It composites every text colour over its background, measures the ratio,
and fails below WCAG AA. This isn't bureaucracy — the original mockups
measured 2.42:1, which is genuinely hard to read, and it wasn't obvious by
eye.

---

## Before you open a pull request

```bash
pnpm validate:content    # plain-English content check
pnpm build               # must succeed
pnpm validate:links      # no broken internal links
pnpm check:contrast      # accessibility floor
pnpm format              # consistent formatting
```

CI runs all of these. If you'd rather just open the PR and let CI tell
you, that's completely fine — that's what it's for.

---

## Commit messages

Say what changed and why. The why matters more; the diff already shows the
what.

Don't add co-author trailers or tool attribution to commits.
