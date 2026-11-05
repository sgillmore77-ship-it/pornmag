# Architecture

This records the important decisions and the reasons for them. Update it when a decision changes.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router), TypeScript | Server rendering for SEO, ISR caching, one codebase for site and CMS. |
| Hosting | Cloudflare Workers via OpenNext | Edge rendering worldwide, R2 for media, Cron for scheduled publishing, Cloudflare for SaaS for custom domains later. Terms don't prohibit legal adult content. The app also runs on any Node host (`next start`), so it isn't locked in. |
| Database | PostgreSQL on Supabase, reached through Cloudflare Hyperdrive | Supabase is used as plain Postgres only — no Supabase Auth or Storage — so the database can be moved to any Postgres host. Hyperdrive pools connections at the edge. |
| ORM | Drizzle | **Changed from Prisma.** Prisma's migration engine is a downloaded binary that couldn't run in the build environment, and Drizzle is pure TypeScript with a smaller Workers bundle. Better Auth supports it directly. The spec allowed "Prisma or another suitable modern ORM". |
| Auth | Better Auth (email + password) | Self-hosted, no per-user fees, database-backed rate limiting that works across Worker isolates. |
| Styling | Tailwind CSS 4 with CSS-variable tokens | Tokens are swapped per publication for white-labelling. |
| Media | Cloudflare R2 + Image Transformations | No egress fees, which matters for an image-heavy site. |

## Multi-tenancy (built in from day one)

- **One `publications` row per magazine.** Phase 1 has one; Phase 2 adds more.
- **Every publisher-owned table has a non-null `publication_id`.** All reads go through `src/data/*`, whose functions take a `Site` (the current publication) and filter on it. Nothing takes a publication id from user input.
- **Routing by domain.** `src/proxy.ts` rewrites `/path` to `/<host>/path` internally, so pages under `app/[site]` know their publication and the ISR cache is separate per site. The host is encoded (`.` → `~`, `:` → `_`) because routers treat dots and colons specially — see `src/lib/host-segment.ts`.
- **Domains** live in `publication_domains` (platform subdomains and custom domains, with `verified_at`). `localhost` and `*.workers.dev` fall back to `DEFAULT_PUBLICATION_SLUG`.
- **Users** are platform-wide identities (one login per email). What someone can do is decided **per publication** by `memberships.role`. Signing up on a site makes you a `user` of that site only. `users.is_super_admin` is the platform owner and can't be set through any API.
- **Tests** in `tests/tenancy.test.ts` check that one site can't see another's content by slug, id, related-content links, homepage picks, trending, categories or sitemaps.
- Possible later hardening: Postgres row-level security as a second lock.

## Content model

- One `content_items` table for articles, reviews, videos and news. Shared fields include title, slug, body, SEO fields, status and dates. Reviews and videos add one-to-one `review_details` and `video_details` rows. Listings, search, homepage sections and related content therefore query one table.
- **Visibility** has one definition (`isLive` in `src/data/content.ts`): status `published` **and** `published_at` in the past. Drafts, archived and future-dated items never appear. Scheduled publishing (1B) is a Cron job that flips `scheduled` items to `published`.
- **Rich text** is stored as the editor's JSON (TipTap/ProseMirror) and rendered on the server by `src/components/rich-text.tsx`. No raw HTML is ever injected, links are restricted to http(s)/mailto/relative, and embeds only render from the allowlist in `src/lib/embeds.ts`.
- **URLs:** `/features/<slug>`, `/reviews/<slug>`, `/videos/<slug>`, `/news/<slug>`. Slugs are unique per publication. Section indexes paginate as `/reviews/page/2`.
- **Related content:** editor-chosen links first, then shared tags (weighted ×2), then same category, then newest.
- **Search:** `search_vector` is a generated, weighted `tsvector` column (title > standfirst > body) with a GIN index. The search UI comes in 1C behind a `SearchProvider` interface, so Meilisearch or Algolia can replace it later.

## Caching and performance

- Public pages use **ISR**: rendered on first request, cached for 5 minutes, then refreshed in the background. On Cloudflare the cache lives in R2, shared by all isolates. Publishing in the CMS (1B) will purge affected pages on demand.
- Account pages are `force-dynamic` and `private, no-store`. This was verified with two users in production mode and on the Workers runtime: neither ever sees the other's page.
- `sitemap.xml` and `robots.txt` are generated per request and cached at the edge for an hour, so **builds never need a database**.
- Images use fixed-ratio boxes (no layout shift), lazy loading, responsive `sizes`, and Cloudflare Image Transformations for AVIF/WebP when enabled.
- Article pages ship almost no JavaScript. Share links are plain links with no third-party scripts.
- Next.js's newer "Cache Components" mode is off. It forces per-host pages into streaming shells, and OpenNext's ISR support is more mature.

## SEO

- Server-rendered HTML with one `<h1>` per page and semantic landmarks.
- Per-item SEO title, meta description, canonical URL, OG image and index/noindex. Defaults fall back to the title, standfirst and hero image.
- Canonicals always point at the publication's primary domain.
- JSON-LD: `NewsMediaOrganization`, `WebSite`, `Article`/`NewsArticle`, `BreadcrumbList`. **Review** markup is added in 1C, once reviewed items carry real details, so we never emit misleading schema.
- The sitemap lists only live, indexable content that is its own canonical. Preview hosts (`*.workers.dev`, http) are disallowed in robots.txt.
- Tag pages default to `noindex` until an editor opts in. Categories only get indexed pages once they have enough content (1B).

## Security

- Passwords are hashed by Better Auth, with a 10-character minimum.
- Rate limits are stored in Postgres: 5 sign-ins/minute, 5 sign-ups/10 min and 3 reset emails/10 min per IP. This is tested.
- Password-reset links expire in an hour and revoke other sessions. The reset request doesn't reveal whether an email exists.
- Production refuses to run auth without `BETTER_AUTH_SECRET`, or to send email without `RESEND_API_KEY`, so misconfiguration fails loudly.
- The Host header is validated before routing.
- Publication brand colours and fonts are validated values, never raw CSS.
- Ad code (1E) will render inside sandboxed containers, not inline in the page.
- `audit_logs` is in place for admin actions from 1B.

## Age assurance and legal

`publications.settings.ageGate` is the hook for an age-verification provider, to be chosen before launch. Which jurisdictions need what is a legal decision. The registration form asks users to confirm they are 18+, which is **not** age verification on its own.

## Phase status

- **1A (done):** project setup, full schema, tenant-scoped data layer, auth (register, login, logout, reset, roles), configurable homepage, article pages, section indexes with pagination, metadata, JSON-LD, sitemap, robots, seed data, tests.
- **Visual design is provisional.** It's token-driven so the Claude Design system can replace it without touching data or routes.
- **Next — 1B:** CMS dashboard, TipTap editor, categories/tags pages and management, SEO fields UI, media uploads to R2, scheduled publishing, redirects, on-demand cache purge.
