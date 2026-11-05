# Deployment

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

**Before launch:** in Admin → Settings, untick "Show empty ad placeholders", and replace the seeded sample stories and placeholder images.

## 3. Your domain

1. Add the domain to Cloudflare (DNS).
2. Workers → pornmag → Settings → Domains & Routes → add `yourdomain.com` (and `www`).
3. Tell the app the domain belongs to the publication. Either re-seed with `SEED_DOMAIN=yourdomain.com`, or insert a row into `publication_domains` with `is_primary = true`.
4. Optional: enable Image Transformations on the zone and set `NEXT_PUBLIC_IMAGE_TRANSFORMS=cloudflare`.

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
