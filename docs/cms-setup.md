# Enabling GitHub sign-in for `/admin`

The content editor at `/admin` is [Sveltia CMS](https://sveltiacms.app). It is
not a separate system: it reads and writes the same markdown files in
`src/content/` that anyone can edit by hand, and it commits them through git.
Anything written through the editor can be edited in a text file afterwards,
and the other way round.

## Try it first — no setup required

```
pnpm dev
```

Open <http://localhost:4321/admin> and choose **Work with local repository**.
Sveltia opens the project folder through the browser's File System Access API
and edits the files on disk directly. There is no login, no token, and nothing
to deploy. Your changes appear as ordinary uncommitted git changes, so
`git diff` shows exactly what the editor wrote.

**Chrome or Edge only.** Firefox and Safari have not shipped the File System
Access API, and Sveltia has no fallback for local mode.

This is the fastest way to see the collections, the fields, and the shape of
the output. Nothing below is needed for it.

## Enabling sign-in on the live site

For editors working at `esra.bot/admin`, the browser needs a GitHub access
token — and it cannot get one on its own, because the OAuth exchange requires a
client secret that must never ship in a public page. A small relay does that
exchange server-side. Four steps.

### 1. Deploy the relay

[`sveltia-cms-auth`](https://github.com/sveltia/sveltia-cms-auth) is a
Cloudflare Workers script that exists only to perform the token exchange. Deploy
it from that repo (the deploy button, or `wrangler deploy`). It lands at:

```
https://sveltia-cms-auth.<your-subdomain>.workers.dev
```

Cloudflare's free Workers tier covers this comfortably — the relay only runs
during a sign-in.

### 2. Register a GitHub OAuth app

On GitHub: **Settings → Developer settings → OAuth Apps → New OAuth App**.

Register it under the **esrabot organization**, not a personal account, so it
outlives any one person's involvement.

| Field                      | Value                                                       |
| -------------------------- | ----------------------------------------------------------- |
| Application name           | ESRA content editor                                         |
| Homepage URL               | `https://esra.bot`                                          |
| Authorization callback URL | `https://sveltia-cms-auth.<subdomain>.workers.dev/callback` |

The callback path is `/callback` exactly.

### 3. Give the relay its credentials

In the Cloudflare dashboard, under **Settings → Variables** for the worker:

| Variable               | Value                                        |
| ---------------------- | -------------------------------------------- |
| `GITHUB_CLIENT_ID`     | from the OAuth app                           |
| `GITHUB_CLIENT_SECRET` | from the OAuth app — **mark this encrypted** |
| `ALLOWED_DOMAINS`      | `esra.bot`                                   |

`ALLOWED_DOMAINS` matters. Without it the relay will mint tokens for a sign-in
started from any site, which turns it into an open credential endpoint. Set it
to the hostnames that should be able to use it and nothing else. Add
`*.vercel.app` only if you want the editor working on preview deployments too,
and understand that widens it to every deployment on that domain.

### 4. Point the CMS at it

In `public/admin/config.yml`, uncomment `base_url` and set it to the worker URL:

```yaml
backend:
  name: github
  repo: esrabot/web
  branch: main
  base_url: https://sveltia-cms-auth.<subdomain>.workers.dev
```

Commit and deploy. `esra.bot/admin` now offers **Sign in with GitHub**.

## Who can edit, and what shows up in the PR

Editors sign in as themselves, so **every commit and pull request is attributed
to their own GitHub account**. There is no shared bot identity — the history
shows who wrote what.

`publish_mode: editorial_workflow` means saving does not touch `main`. The
editor opens a branch and a pull request, which gets the normal CI checks and a
Vercel preview, and a person merges it. So the review path is identical whether
a change arrives from the editor or from someone editing markdown by hand.

`open_authoring: false` means editors need write access to `esrabot/web`. Add
them to the org first. Setting it to `true` instead lets anyone with a GitHub
account propose changes from a fork — useful for accepting outside
contributions, at the cost of anyone being able to open a PR.

## If sign-in fails

- **"Not allowed" / the popup closes immediately** — the site's hostname is not
  in `ALLOWED_DOMAINS`.
- **GitHub redirect error** — the callback URL in the OAuth app does not match
  the worker URL exactly, including `/callback`.
- **Signs in, then "repository not found"** — the account lacks write access to
  `esrabot/web`, or the org restricts OAuth app access and the app has not been
  approved. Check **Organization settings → Third-party Access**.
