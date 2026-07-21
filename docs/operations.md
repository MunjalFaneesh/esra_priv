# Operations: hosting, DNS, and email

Everything needed to take `esra.bot` live and keep it running. Work top to
bottom — later steps assume earlier ones.

Related: [`docs/cms-setup.md`](cms-setup.md) for the `/admin` editor,
[`docs/ccbr-dev-retirement.md`](ccbr-dev-retirement.md) for the old-URL map.

---

## The short version

| #   | Task                                                  | Where                | Blocks                    |
| --- | ----------------------------------------------------- | -------------------- | ------------------------- |
| 1   | Add three secrets, enable Actions deploy              | GitHub               | the site deploying at all |
| 2   | Add `esra.bot` to the Vercel project                  | Vercel               | the domain resolving      |
| 3   | Move DNS from Dynadot to Cloudflare                   | Dynadot + Cloudflare | everything below          |
| 4   | Point `esra.bot` at Vercel (A record, **grey cloud**) | Cloudflare           | the site loading          |
| 5   | Add Zoho mail records (MX/SPF/DKIM/DMARC)             | Cloudflare           | email working             |
| 6   | Deploy the Sveltia auth worker                        | Cloudflare           | `/admin` sign-in          |
| 7   | (later) Blog comments, OG cards                       | —                    | non-critical              |

---

## 1. Deploying: GitHub Actions + a Vercel token

**Why this way.** Vercel's Hobby plan will not deploy a _private_ repository
owned by an _organization_, which is what `esrabot/web` is. So instead of
connecting Vercel to GitHub, [`deploy.yml`](../.github/workflows/deploy.yml)
builds the site inside GitHub Actions and uploads the finished output to Vercel
with a token. Vercel never needs to see the repo. This keeps the source private
while the content is being vetted.

Add three repository secrets — **Settings → Secrets and variables → Actions →
New repository secret**:

| Secret              | Value                              | Where to get it                                                                              |
| ------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------- |
| `VERCEL_TOKEN`      | a personal token                   | <https://vercel.com/account/tokens> — create one, scope it to the team that owns the project |
| `VERCEL_ORG_ID`     | `team_OdgeKlEMN99sSdnvgmyoUpFY`    | already in `.vercel/project.json`                                                            |
| `VERCEL_PROJECT_ID` | `prj_6X2OWTk0VYjbRD8bz5PTO42YnC5D` | same file                                                                                    |

Once `VERCEL_TOKEN` exists, every push to `main` deploys to production and every
pull request gets a preview URL commented on it. Until it exists, the workflow
skips itself with a warning rather than failing — so merging this is safe before
you have the token.

The scheduled rebuild (every 6h, to refresh GitHub/YouTube data) rides the same
workflow. `refresh.yml` is deliberately dormant; it is the path to switch back
to once native Vercel Git deploys are available (see the end of this doc).

## 2. Add the domain to the Vercel project

Even deploying by token, the domain is attached in Vercel: **Project → Settings →
Domains → Add** `esra.bot` (and `www.esra.bot`). Vercel will show the exact DNS
record it wants and a verification state that stays pending until step 4.

## 3. Move DNS from Dynadot to Cloudflare

You keep the _registration_ at Dynadot and hand _DNS_ to Cloudflare by changing
the domain's nameservers. Nothing about ownership or renewal changes.

1. **Add the site to Cloudflare.** <https://dash.cloudflare.com> → **Add a
   site** → `esra.bot` → choose the **Free** plan. Cloudflare scans existing
   records; since the domain is mostly unconfigured there will be little to
   import. It then shows you two nameservers, e.g.
   `xavier.ns.cloudflare.com` / `dana.ns.cloudflare.com`.
2. **Point Dynadot at them.** Dynadot → **My Domains → `esra.bot` → Nameservers**
   → choose **Use your own nameservers** and enter the two Cloudflare gave you,
   replacing Dynadot's. Save.
3. **Wait for it to flip.** Cloudflare emails you when the domain is active,
   usually well under an hour but allow up to 24. Add every record below
   _before_ it flips if you can, so services come up the moment DNS moves.

> Dynadot currently has the domain on `dyna-ns.net` with no records. After this
> step, Cloudflare is the only place DNS records are edited — Dynadot's DNS panel
> stops having any effect.

## 4. Point the domain at Vercel

First **add `esra.bot` to the `esra-web` project** (step 2) — the domain is not
attached yet, only `rudynamics.org` and `willcforte.com` are on the account.
Vercel's Domains screen then shows the exact record to create.

In Cloudflare **DNS → Records**, add it. The standard Vercel apex setup, and the
reliable one:

| Type  | Name  | Value                  | Proxy                     |
| ----- | ----- | ---------------------- | ------------------------- |
| A     | `@`   | `76.76.21.21`          | **DNS only (grey cloud)** |
| CNAME | `www` | `cname.vercel-dns.com` | **DNS only (grey cloud)** |

Use the exact IP/target Vercel shows for the project — it is authoritative and
occasionally differs from the above.

**On the grey vs. orange cloud.** With the proxy ON (orange cloud), Cloudflare
terminates TLS, and during initial setup Vercel cannot complete its certificate
challenge — the domain can sit "invalid configuration" with redirect loops. The
dependable path is **grey-cloud (DNS-only)** and let Vercel serve TLS directly.

Your `rudynamics.org` actually runs orange-clouded through Cloudflare into
Vercel, so if you want the same for `esra.bot` (Cloudflare CDN/DDoS in front):
grey-cloud first, wait for Vercel to issue the cert and go green, set Cloudflare
**SSL/TLS → Full (strict)**, then flip to orange. Doing it in that order avoids
the provisioning deadlock.

## 5. Email — already configured, carry it across carefully

**Email is already set up and working.** `esra.bot` on Dynadot already serves
the full Zoho record set: MX (mx/mx2/mx3.zoho.com), the `zoho-verification` TXT,
and SPF (`v=spf1 include:zohomail.com ~all`). Mail to `info@`, `engineering@`,
and `vibhu@esra.bot` flows today.

That means step 3 (moving nameservers to Cloudflare) is the **risky** step for
email: whatever Cloudflare does not know about stops existing the moment the
nameservers flip. So:

1. When you add the site in Cloudflare, its scanner imports existing records.
   **Verify every mail record came across** before flipping — the three MX, the
   `zoho-verification` TXT, and the SPF TXT. Re-add by hand anything missing.
2. Only then change the nameservers at Dynadot.

The current records to preserve:

| Type | Name | Value                                                        |
| ---- | ---- | ------------------------------------------------------------ |
| MX   | `@`  | `mx.zoho.com` (10), `mx2.zoho.com` (20), `mx3.zoho.com` (50) |
| TXT  | `@`  | `zoho-verification=zb12282582.zmverify.zoho.com`             |
| TXT  | `@`  | `v=spf1 include:zohomail.com ~all`                           |

### One bug to fix during the move: DKIM is in the wrong place

There is a `v=DKIM1; k=rsa; p=…` record published at the **apex** (`esra.bot`
itself). DKIM at the apex does nothing — verifiers only look it up at
`<selector>._domainkey.esra.bot`, and nothing is published there, so outgoing
mail is currently **unsigned**. Not urgent (mail still delivers on SPF), but
worth fixing while you are in the DNS anyway:

1. In **Zoho Admin Console → Email Configuration → DKIM**, read the **selector**
   Zoho assigned for `esra.bot` and its public key.
2. In Cloudflare, publish that key as TXT at `<selector>._domainkey` (not at
   `@`), then delete the stray apex `v=DKIM1` record.
3. Back in Zoho, click **Verify** on the DKIM entry.

### Add DMARC (recommended, not present today)

`_dmarc.esra.bot` has no record. Add one, starting permissive:

| Type | Name     | Value                                        |
| ---- | -------- | -------------------------------------------- |
| TXT  | `_dmarc` | `v=DMARC1; p=none; rua=mailto:info@esra.bot` |

Leave it at `p=none` (monitor only) for a week or two; once SPF and DKIM verify
clean, tighten to `p=quarantine` then `p=reject`.

Note: keep exactly **one** SPF record. The apex already has the correct one —
don't add a second, since two `v=spf1` records is a hard failure.

### About Cloudflare Email Routing for aliases

You mentioned using Cloudflare Email Routing to make receive-only aliases. Heads
up: **you can't run that and Zoho at the same time on `esra.bot`.** Cloudflare
Email Routing works by pointing the domain's MX at _Cloudflare_ so it receives
the mail first — which directly conflicts with the MX pointing at Zoho above. A
domain has exactly one mail receiver.

So while Zoho holds the mailboxes:

- **Make aliases in Zoho, not Cloudflare.** Zoho lets a user hold several
  addresses (e.g. `press@` delivering to whoever reads `info@`), and shared
  addresses can be modelled as Zoho Groups. That covers receive-only aliases
  without touching MX.
- Cloudflare Email Routing only becomes the right tool if you later decide _not_
  to run real Zoho mailboxes and instead forward everything to personal inboxes
  — a different setup, and not the current plan.

Sources for the conflict: [Zoho's own Cloudflare guide](https://www.zoho.com/mail/help/adminconsole/cloudflare.html),
[Cloudflare community](https://community.cloudflare.com/t/zoho-mx-records-and-cloudflare-mx-records-for-same-domain/707473).

## 6. The `/admin` content editor

Full steps are in [`docs/cms-setup.md`](cms-setup.md). In brief: it already works
locally today with zero setup (`pnpm dev`, open `/admin`, "Work with local
repository"). For sign-in on the live site you deploy the
[`sveltia-cms-auth`](https://github.com/sveltia/sveltia-cms-auth) Cloudflare
Worker, register a GitHub OAuth app under the **esrabot org**, set
`ALLOWED_DOMAINS=esra.bot` on the worker, and uncomment `base_url` in
`public/admin/config.yml`. Editors then sign in as themselves and their edits
arrive as pull requests.

## 7. Later, not blocking

- **Blog comments (giscus).** giscus requires a **public** repo with Discussions
  enabled — it cannot run against a private one. So comments stay off until the
  repo is public, or point giscus at a separate public repo made only to hold
  discussions. The wiring is in the blog layout, commented, waiting on the repo
  IDs.
- **Per-page social cards (OG images).** A static default ships now; per-page
  generated cards are tracked but not built.

---

## When the repo goes public (or you upgrade to Pro)

The token-deploy setup exists only to work around the Hobby + private-org-repo
limit. Once that limit is gone:

1. Connect the repo in the Vercel dashboard (**Project → Settings → Git**).
2. Create a Deploy Hook and store it as `VERCEL_DEPLOY_HOOK`.
3. Restore the `schedule` / `repository_dispatch` triggers in `refresh.yml`.
4. Delete `deploy.yml` and its three secrets.

Native Git deploys are simpler and give first-class PR previews. Everything else
— DNS, email, `/admin` — is unaffected by the switch.
