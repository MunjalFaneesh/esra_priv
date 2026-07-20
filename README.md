# esrabot/web

The ESRA website — [esra.bot](https://esra.bot).

Built in the open, like everything else here. If you want to change what
the site _says_, you almost certainly want **[BLOGGING.md](./BLOGGING.md)**
or **[CONTRIBUTING.md](./CONTRIBUTING.md)** rather than this file.

---

## What this is

A statically generated [Astro](https://astro.build) site. Every page is
prerendered to HTML at build time and served from a CDN — there is no
server rendering, no database, and no client-side data fetching.

External data (repository statistics, video listings) is fetched **during
the build** and baked into the HTML. A scheduled job rebuilds the site so
that data stays current without anyone running a build by hand.

```
push to main   ─┐
cron, 6h       ─┼─→ GitHub Action ─→ astro build ─→ Vercel
org repo push  ─┘         │
                          ├─ GitHub API      (repos, stars, commits)
                          ├─ YouTube feeds   (per-org channels)
                          └─ src/content/    (markdown, YAML)
```

Publishing a post does not wait for the cron: committing markdown to
`main` triggers a deploy immediately.

---

## Quick start

```bash
pnpm install
pnpm dev          # http://localhost:4321
```

| Command                 | What it does                                             |
| ----------------------- | -------------------------------------------------------- |
| `pnpm dev`              | Development server                                       |
| `pnpm build`            | Production build into `dist/`                            |
| `pnpm preview`          | Serve the built site locally                             |
| `pnpm validate:content` | Check content files, in plain English                    |
| `pnpm validate:links`   | Check every internal link resolves (needs a build first) |
| `pnpm check:contrast`   | Verify colour contrast meets WCAG AA                     |
| `pnpm typecheck`        | Type and template checking                               |
| `pnpm optimize:assets`  | Re-compress images in `src/assets/`                      |

---

## Layout

```
src/
  content/          ← the site's actual content
    blog/             posts (.md / .mdx)
    members/          one file per person
    projects/         curated project pages
    docs/             field guides
    boms/             bills of materials
    gallery.yaml      photo and video index
    partners.yaml     affiliated clubs
  data/
    orgs.ts           every social/org URL, defined once
    site.ts           site constants and navigation
  components/
    ui/               design-system primitives
    blog/             the markdown authoring vocabulary
  lib/
    github.ts         repo data, cached, degrades gracefully
    youtube.ts        channel feeds
    feed.ts           RSS with media enclosures
  styles/
    tokens.css        every colour, size, and spacing value
  pages/            ← routes
scripts/            ← validation and asset tooling
```

### Two rules worth keeping

**Content lives in `src/content/`, never in a component.** If you find
yourself typing a person's name or a repo's star count into a `.astro`
file, it belongs in content or comes from an API instead.

**Design values live in `src/styles/tokens.css`, never inline.** There
should be no raw hex codes or pixel spacing anywhere else. The token file
documents the measured contrast ratio of every text colour, and
`pnpm check:contrast` fails the build if a change drops below WCAG AA.

---

## Design system

The visual language comes from a set of design mockups: a 24px baseline
grid, a document "sheet" over a grey field, monospace labelling, and
hairline rules. Influences are U.S. Graphics Company, NASA documentation,
Dieter Rams, and Bell Labs-era terminal interfaces.

Two deliberate departures from the mockups are documented in
[tokens.css](./src/styles/tokens.css):

- **Typography.** The mockups specify Berkeley Mono and Houston Mono, both
  commercial licences. The site ships self-hosted IBM Plex Mono (OFL). To
  swap in a licensed face, add the `woff2` and change two custom
  properties — no other file names a typeface.

- **Surfaces.** The mockups' muted labels measured 2.42:1, below even the
  3:1 large-text floor. Note that lifting the background alone cannot fix
  this, because the muted tones are translucent ink composited over it and
  rise with it — at the limit, the mockup's `.45` alpha on pure white
  still only reaches 4.05:1. Surfaces were lifted _and_ text darkened, to
  4.80:1.

---

## Deployment

Hosted on Vercel via the Git integration — every push builds, and every
pull request gets a preview URL.

Configuration lives in [`vercel.json`](./vercel.json). Secrets needed:

| Secret                      | Where               | Why                                       |
| --------------------------- | ------------------- | ----------------------------------------- |
| `VERCEL_DEPLOY_HOOK`        | GitHub repo secret  | Lets the scheduled job trigger a rebuild  |
| `GITHUB_TOKEN`              | provided by Actions | Authenticated API rate limit during build |
| `PUBLIC_GISCUS_REPO_ID`     | Vercel env          | Enables blog comments                     |
| `PUBLIC_GISCUS_CATEGORY_ID` | Vercel env          | Enables blog comments                     |

The site degrades rather than fails when these are absent: no deploy hook
means no scheduled refresh, no giscus IDs means the comments section
explains that it isn't enabled yet.

---

## Licence

Site code MIT. Written content and photographs belong to their authors,
credited in each file.
