# Retiring ccbr.dev

**Status: planned, not applied.** Nothing in this document is live. It exists
so the cutover is a decision rather than an investigation.

The old Nuxt site (`esrabot/site`) is served at `ccbr.dev`. This site replaces
it at `esra.bot`. The two can run side by side indefinitely — do the cutover
when it suits.

---

## The good news

The blog slugs were kept identical on purpose, so **every post URL maps
one-to-one with no rewriting**. A single path-preserving redirect at the
domain level covers most of the site.

## Full URL map

| ccbr.dev                 | esra.bot                 | Notes                                                     |
| ------------------------ | ------------------------ | --------------------------------------------------------- |
| `/`                      | `/`                      | Rebuilt, not migrated — the old landing page was Nuxt MDC |
| `/blog`                  | `/blog`                  |                                                           |
| `/blog/welcome`          | `/blog/welcome`          | identical                                                 |
| `/blog/analysis-of-orgs` | `/blog/analysis-of-orgs` | identical                                                 |
| `/blog/a-nyc-summer`     | `/blog/a-nyc-summer`     | identical                                                 |
| `/blog/our-site-is-live` | `/blog/our-site-is-live` | identical                                                 |
| `/gallery`               | `/gallery`               |                                                           |
| `/team`                  | `/members`               | **renamed** — already handled in `vercel.json`            |
| `/docs`                  | `/docs`                  | was an empty stub; now a real section                     |
| anything else            | `/`                      | catch-all                                                 |

Individual member pages did not exist on the old site, so nothing points at
them. They now live at the site root (`/willcforte`) with the roster at
`/members`.

## Assets

Old media paths are **not** preserved. The old site served from `/avatars/`,
`/blog-images/`, `/carousel/`, and `/uploads/`; this site processes images
through the build pipeline into hashed `_astro/` filenames.

That matters only if something external hot-links an image from ccbr.dev.
Nothing in either repo does. If you find one after cutover, add a redirect
for that specific file — a blanket rule isn't possible because the new
filenames are content-hashed.

Video is the exception and _is_ stable:

| old                                      | new                                   |
| ---------------------------------------- | ------------------------------------- |
| `/carousel/running_leg.mp4`              | `/media/running-leg.mp4`              |
| `/carousel/spinning_custom_actuator.mp4` | `/media/spinning-custom-actuator.mp4` |

---

## Cutover steps

1. **Point DNS.** `esra.bot` currently has nameservers (`dyna-ns.net`) but no
   A record. Add the Vercel records for `esra.bot` and `www.esra.bot`.

2. **Verify esra.bot serves correctly** before touching ccbr.dev. There is no
   deadline; leave both up as long as you like.

3. **Attach ccbr.dev to this Vercel project** and set it to redirect to
   `esra.bot`. Vercel's domain-level redirect preserves the path, which is
   why the identical slugs matter — `ccbr.dev/blog/a-nyc-summer` lands on
   `esra.bot/blog/a-nyc-summer` with no per-post rules.

   The `/team` → `/members` rule is already in `vercel.json`, so it applies
   after the domain redirect and needs no separate handling.

4. **Update the GitHub org.** `esrabot`'s profile `blog` field already reads
   `https://esra.bot`. The old repo's `app/constants.ts` still points at the
   dead `CCBR-Humanoid` org — worth fixing or archiving the repo outright.

5. **Update off-site links** that point at ccbr.dev:
   - Rutgers Dynamics Linktree — "See Our Collaborators" currently links to
     `https://www.ccbr.dev/`
   - the LinkedIn company pages for both orgs
   - the `esrabot/site` repo description and homepage field

6. **Archive `esrabot/site`** once traffic has drained, so nobody edits the
   wrong repo. Keep it public — it's the history of the project.

---

## Things to decide before step 3

- **Does ccbr.dev redirect forever, or expire?** Redirecting indefinitely is
  cheap and preserves any links in others' posts and papers. Recommended.

- **Should the CCBR name stay visible?** Several accounts still carry it
  (LinkedIn `ccbr-robotics`, YouTube `@CCBRRobotics`, the `ccbrrobotics@`
  address), and the archived blog posts are written under it. The site
  currently records CCBR as ESRA's former name in structured data, which
  keeps the history legible without leading with it.
