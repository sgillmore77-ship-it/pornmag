# Deployment

## How it deploys (current setup)

Every push to `main` runs CI (`.github/workflows/ci.yml`). When the checks pass, the
`deploy` job creates or finds the Cloudflare resources (`scripts/cf-setup.mjs`), runs
database migrations, builds with OpenNext, deploys the Worker, generates the Worker's
own secrets once, and checks the homepage loads. Live at
`https://pornmag.<account-subdomain>.workers.dev` until a custom domain is attached.

Repository secrets it needs (GitHub → Settings → Secrets and variables → Actions):

| Secret | What |
|---|---|
| `CLOUDFLARE_API_TOKEN` | User token with Workers Scripts, Workers R2 Storage, D1 and Hyperdrive (Edit), Account Settings, User Details and Memberships (Read) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| `HYPERDRIVE_DATABASE_URL` | Supabase **direct** connection string (used by Cloudflare) |
| `DATABASE_URL` | Supabase **session pooler** string (used by GitHub for migrations; GitHub runners have no IPv6) |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Admin login created by "Load sample content" |
| `RESEND_API_KEY` (optional) | Enables password-reset and other emails |

"Load sample content" (Actions tab, run manually, type `REPLACE`) loads the design
samples and creates the admin account. It deletes the `main` publication first, so it
is for an empty site only.

The sections below describe the pieces in more detail.


The site runs on Cloudflare Workers, with Supabase Postgres as the database and Cloudflare R2 for media and the page cache. These steps are needed once.

## What you need

| Service | Plan | Used for |
|---|---|---|
| Cloudflare | Workers Paid (~$5/month) | Hosting, Hyperdrive, R2, domains. The free plan's CPU limit is too low for server-rendered pages. |
| Supabase | Free to start; Pro (~$25/month) at launch | Postgres. Free projects pause after a week without activity. |
| Resend | Free tier | Password-reset emails. Needs a domain you can add DNS records to. |

## 1. Database (Supabase)

1. Create a project. Note the database password.
2. Project Settings → Database → copy the **direct connection** string (port 5432).
3. Locally, put it in `.env` as `DATABASE_URL`, then run:
   ```
   npm run db:migrate
   SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD='a long password' npm run db:seed
   ```
   The seed is sample content. On a real launch, run it once to create the admin account and homepage layout, then delete the sample stories from the CMS (1B).

## 2. Cloudflare

```
npx wrangler login
npx wrangler hyperdrive create pornmag-db --connection-string="<Supabase direct connection string>"
npx wrangler r2 bucket create pornmag-cache
npx wrangler r2 bucket create pornmag-media
npx wrangler d1 create pornmag-tag-cache
```

Then:

- Put the Hyperdrive id and the D1 database id into `wrangler.jsonc` (replace `REPLACE_WITH_HYPERDRIVE_ID` and `REPLACE_WITH_D1_ID`).
- Make `pornmag-media` public, or attach a custom domain such as `media.yourdomain.com`. Set `NEXT_PUBLIC_MEDIA_BASE_URL` to that URL **at build time**.
- Set secrets:
  ```
  npx wrangler secret put BETTER_AUTH_SECRET     # openssl rand -base64 32
  npx wrangler secret put RESEND_API_KEY
  npx wrangler secret put CRON_SECRET            # any long random string; enables scheduled publishing
  ```
- Add the plain variables `EMAIL_FROM` and `DEFAULT_PUBLICATION_SLUG=main` under `vars` in `wrangler.jsonc` or in the dashboard.

Deploy:

```
npm run deploy
```

The site is now live at `pornmag.<your-subdomain>.workers.dev`. Search engines are blocked there via robots.txt. Sign in with the admin account and open `/admin`.

**Before launch:** in Admin → Ads, untick "Show labelled empty boxes", and replace the seeded sample stories, comments, analytics numbers and placeholder images (the seed is for reviewing the design, not for production).

## 3. Your domain

Live domain: **asstomouth.net** (zone added 8 Nov 2026; registrar 123-reg, nameservers `achiel` / `selah.ns.cloudflare.com`).

1. Add the domain to Cloudflare (DNS).
2. Attach it to the Worker with `routes` (`custom_domain: true`) in `wrangler.jsonc` for the bare host and `www`. Remove any existing DNS records for those names first (custom domains can't sit on top of them). The deploy token needs Zone Read, DNS Edit and Workers Routes Edit for the zone.
3. Tell the app the domain belongs to the publication. For asstomouth.net this is migration `0004_custom_domain.sql` (rows in `publication_domains`). **Re-running the seed deletes these rows** (it replaces the "main" publication); afterwards re-run that SQL in the Supabase SQL editor.
4. `CANONICAL_HOSTS` in `wrangler.jsonc` makes `www.<host>` 301 to `<host>` in the Worker. Responses on `*.workers.dev` carry `X-Robots-Tag: noindex` so only the real domain gets indexed.
5. Optional: enable Image Transformations on the zone and set `NEXT_PUBLIC_IMAGE_TRANSFORMS=cloudflare`.
6. Media domain: add a Cache Rule for `media.yourdomain.com/*` with a long edge and browser TTL (files never change under the same name).
7. Optional: Cloudflare → Web Analytics → add the site, then paste the token into Admin → Ads → "Cloudflare Web Analytics token". The built-in counts work without it.
8. Ad networks: paste their ads.txt lines into Admin → Ads; they're served at `/ads.txt`.

## Local development

```
cp .env.example .env      # fill in DATABASE_URL and BETTER_AUTH_SECRET
npm install
npm run db:migrate && npm run db:seed
npm run dev               # http://localhost:3000
npm test                  # needs TEST_DATABASE_URL (a separate, disposable database)
npm run preview           # build and run in Cloudflare's runtime locally
```

When previewing in the Workers runtime, browse `http://localhost:8787`, not `127.0.0.1`. Bare IP hosts don't route there; real deployments always use domain names.
