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
- **Search:** `search_vector` is a generated, weighted `tsvector` column (title > standfirst > body) with a GIN index. `/search` uses it through the `SearchProvider` interface in `src/lib/search/` (prefix matching, ranked, tenant-scoped, published only), so Meilisearch or Algolia can replace it later without touching pages.

## Caching and performance

- Public pages use **ISR**: rendered on first request, cached for 5 minutes, then refreshed in the background.
  - On Cloudflare the page cache lives in R2, shared by all isolates. Background regeneration runs through a Durable Object queue, and cache tags are stored in D1 (`open-next.config.ts`).
  - Every cached page carries its publication's tag (`site:<id>`, attached in `getSiteContext`). Any admin change readers can see calls `updateTag`, so the next request for any page of that site, and only that site, is fresh. This is verified on the Workers runtime.
- Account pages are `force-dynamic` and `private, no-store`. This was verified with two users in production mode and on the Workers runtime: neither ever sees the other's page.
- `sitemap.xml` and `robots.txt` are generated per request and cached at the edge for an hour, so **builds never need a database**.
- Images use fixed-ratio boxes (no layout shift), lazy loading, responsive `sizes`, and Cloudflare Image Transformations for AVIF/WebP when enabled.
- Article pages ship almost no JavaScript. Share links are plain links with no third-party scripts.
- Next.js's newer "Cache Components" mode is off. It forces per-host pages into streaming shells, and OpenNext's ISR support is more mature.

## SEO

- Server-rendered HTML with one `<h1>` per page and semantic landmarks.
- Per-item SEO title, meta description, canonical URL, OG image and index/noindex. Defaults fall back to the title, standfirst and hero image.
- Canonicals always point at the publication's primary domain.
- JSON-LD: `NewsMediaOrganization`, `WebSite`, `Article`/`NewsArticle`, `BreadcrumbList`. `Review` (rating 0–5; the item reviewed is a WebSite/Product/Service when the subject is one, otherwise the release credited to its studio or creator) and `VideoObject` (only when there is a real thumbnail and an approved embed).
- The sitemap lists only live, indexable content that is its own canonical. Preview hosts (`*.workers.dev`, http) are disallowed in robots.txt.
- Tag pages default to `noindex` until an editor opts in. Categories only get indexed pages once they have enough content (1B).

## Admin (CMS)

- Lives at `/admin` on each publication's own domain. It is `force-dynamic` and noindex, and has its own chrome (no public header, footer or age gate).
- **Every mutation is a server action** in `src/app/[site]/admin/actions.ts`. Each one:
  - resolves the publication from the request's Host header, never from client input;
  - re-checks the user's permission (`requireAdmin`);
  - writes an `audit_logs` row;
  - refreshes the site cache when readers would see the change.
- **Data rules** live in `src/data/admin/*`. Every referenced id (category, images, authors, related stories, homepage picks) is checked to belong to the same publication, and a save that doesn't match exactly one row in this publication aborts before touching link tables.
- **Workflow:** authors create and edit their own drafts only. Editors and admins schedule and publish. A first publish sets the date, and later edits keep it.
- **Scheduling:** a Cloudflare Cron trigger (every 5 minutes, `worker.ts`) calls `POST /api/cron/publish` with `CRON_SECRET`. That publishes due items across all publications and refreshes their caches.
- **Media:** uploads are checked by their bytes (JPEG/PNG/WebP/AVIF/GIF only, so no SVG or HTML), are limited to 15 MB, and are stored under `<publication>/<yyyy>/<mm>/<uuid>.<ext>` in R2 (local `public/media` in development). Alt text, caption and credit are edited in the library.
- **Editor:** TipTap with custom `pullQuote` and `embed` nodes. Images keep their storage key. Embeds only accept approved providers (YouTube/Vimeo for now, `src/lib/embeds.ts`).
- **Redirects** are stored per publication and followed for any unmatched or missing URL (`notFoundOrRedirect`), with a hit counter.
- The admin screens use the design tokens but weren't in the Claude Design handoff. They can be art-directed later without touching logic.

## Security

- Passwords are hashed by Better Auth, with a 10-character minimum.
- Rate limits are stored in Postgres: 5 sign-ins/minute, 5 sign-ups/10 min and 3 reset emails/10 min per IP. This is tested.
- Password-reset links expire in an hour and revoke other sessions. The reset request doesn't reveal whether an email exists.
- Production refuses to run auth without `BETTER_AUTH_SECRET`, or to send email without `RESEND_API_KEY`, so misconfiguration fails loudly.
- The Host header is validated before routing.
- Publication brand colours and fonts are validated values, never raw CSS.
- Ad code (1E) will render inside sandboxed containers, not inline in the page.
- `audit_logs` is in place for admin actions from 1B.

## Design system

The visual design comes from the Claude Design handoff ("design system + homepage").

- **Tokens:** `src/app/magazine.css` holds the tokens and components. It defines neutrals for light and dark (`data-mode` = light, dark or system) and a fixed-dark video band. `src/lib/theme.ts` sets the per-publication values inline on `.site`: brand colour, on-brand text (black or white by luminance, threshold 0.36), brand-as-text for each mode, and the type pairing variables (`--fd --fb --dw --dt --dls --dlh --dsz`).
- **Type pairings:** Couture (Bodoni Moda + Hanken Grotesk, the default), Poster (Anton + Archivo) and Literary (Instrument Serif + Schibsted Grotesk), with IBM Plex Mono for labels. Fonts are self-hosted via Fontsource, with no Google Fonts requests. Browsers only download the faces a page uses.
- **Two homepage directions,** switchable per publication with `publications.theme.layout`:
  - `issue` (1b, the default): cover-led, giant masthead, score ring, outlined rank numbers, typographic category index.
  - `feed` (1a): grid-led, split hero, rails of review cards and picks, 4-column video grid.
  - Both render the same ordered `homepage_sections`. The header and footer follow the chosen direction.
- **Responsive behaviour** uses container queries against `.site` (`cqw` units, as in the design). Mobile swaps (compact story rows, ad sizes, burger menu) happen at a 700px container width.
- **Placeholder imagery:** seeded media use the storage key `placeholder:<tone>` plus an art-direction caption. They render as the design's striped blocks with an "IMG · …" label, and are never used in OG tags or structured data. Real uploads (1B) replace them.
- **Ad slots** have reserved sizes per slot (desktop/mobile), so nothing shifts. `settings.ads.previewPlaceholders` shows labelled empty boxes for layout review. **Turn it off before launch.**
- **Age gate:** a self-declared "Adults only" interstitial, enabled by `settings.ageGate.enabled`. It is in the server HTML and hidden before paint for returning readers via a cookie. It is not age verification (see below).
- **Navigation, footer columns and the issue dateline** come from `publications.settings` (`nav`, `footer`, `issueLabel`), so they become CMS-editable in 1B. Only pages that exist are linked.
- **Not built yet, so not shown:** Search, My Favorites, Contact, the newsletter form, and Terms/Privacy/2257 pages. The newsletter section exists but is disabled until there's a real email list behind it.

## Age assurance and legal

`publications.settings.ageGate` is the hook for an age-verification provider, to be chosen before launch. Which jurisdictions need what is a legal decision. The registration form asks users to confirm they are 18+, which is **not** age verification on its own.

## Phase status

- **Design system applied:** both homepage directions, article, review, listing and category pages, account pages, age gate, mobile menu.
- **1A (done):** project setup, full schema, tenant-scoped data layer, auth (register, login, logout, reset, roles), configurable homepage, article pages, section indexes with pagination, metadata, JSON-LD, sitemap, robots, seed data, tests.
- **1B (done):** admin dashboard, content list and editor (TipTap), SEO panel, workflow and scheduling, media library with uploads, categories/tags/authors, public tag pages, homepage manager (layout switch, ordering, picks), site settings (branding, type pairing, navigation, behaviour), redirects, activity log, per-site cache refresh.
- **1C (done):** studios & creators admin; review fields (score out of 5 in half steps, badge, verdict, pros/cons, price, release year, sponsored link with disclosure); video fields (approved embed link, duration, studio, optional rating) with a click-to-play player; Review and VideoObject structured data; site search with type filters; related content weighted by shared studio/creator, then tags, then category.
- **1D (done):** comments (threaded one level, edit for 15 minutes, delete, report), public reader profiles at `/u/<handle>`, saved stories, account page, "Report this page" (consent, age, copyright, legal), admin moderation queue with bulk actions, page reports with "take offline", People (roles, comment blocks), dashboard counts, comment moderation mode in Settings.
- **1E (done):** ad placements (network code in a sandboxed frame, or directly sold banners with click counting), rotation, scheduling, per-device targeting, ads.txt; first-party cookie-free analytics (page views, story views, traffic sources, top stories, ad impressions and clicks) with an Analytics page; optional Cloudflare Web Analytics; font preloading and long-lived font caching.
- **Next — Phase 2:** multi-tenant SaaS (publication sign-up, per-publication billing and domains, platform admin).

Videos can only be published with a link from an approved provider (`src/lib/embeds.ts`). Add licensed partners there.

## Community (1D)

- **Story pages stay cached.** Comments, the Save button and the reader's identity load after the page arrives (a server action), so the cached HTML is the same for everyone.
- **Privacy.** Readers comment under a per-publication handle; real names and emails are never shown publicly. Profiles are per publication, so one reader's identity on one magazine isn't visible on another. Profile pages are `noindex`.
- **Moderation mode** (Settings → Comments): check every reader's first comment (default), check all, publish straight away, or off. Staff skip the queue. Comments with more than two links are always held.
- **Automatic holds.** Three open reports, or one "involves a minor" report, take a comment down until a moderator decides.
- **Limits.** 2,000 characters; one post every 15 seconds and five per 10 minutes per reader; no duplicate posts within 24 hours. IPs are stored only as a keyed hash.
- **Roles.** Moderators handle comments and page reports and can block readers; only administrators change roles or block team members; a site always keeps one administrator. Editors can take a reported page offline.
- **Later:** reply notifications by email (needs Resend), account deletion and data export (with the legal work).

## Ads (1E)

- **Pages stay cached.** The page carries the reserved box and the list of running ads for each slot; the browser picks one (weighted, by device, re-checking start/end times) once the box is near the screen and the reader is past the age screen. Every slot has fixed desktop and mobile sizes (`src/lib/ad-sizes.ts`), so nothing shifts.
- **Network code runs in a sandboxed iframe** (`allow-scripts allow-popups allow-popups-to-escape-sandbox`, no same-origin): it can't read the page, readers' sessions or cookies, and can't redirect the page. Some networks' pop-under or "in-page push" formats won't work inside it; use their iframe/async banner tags. Only administrators can add ad code.
- **Banners sold directly** link through `/api/ads/click/<id>`, which counts the click and redirects (https only). The advertiser's URL never appears in the page.
- **Impressions** are counted when half the ad has been on screen for a second, batched and sent with `sendBeacon`.

## Analytics (1E)

- `PageView` (in the public layout) sends one beacon per page per browser session to `/api/t` with the path and referrer. The server keeps only counts: views per story per day (`content_daily_stats`) and views per traffic source per day (`traffic_daily_stats`). No cookies, IPs or user identifiers are stored, so no consent banner is needed for it.
- Bots and tools are filtered by user agent; beacons from other sites are ignored (Origin and Sec-Fetch-Site checks). Counts can still be inflated by a determined script; add a Cloudflare rate-limiting rule on `/api/t` and `/api/ads/*` in production.
- Days are the publication's time zone. Trending uses the same counts.

## Performance (1E)

- Fonts are self-hosted from `public/fonts` (generated by `scripts/build-fonts.mjs`) with year-long immutable caching (`public/_headers`). Each site preloads only its pairing's display and body faces plus the mono label face, which removed the layout shift from font swapping (CLS 0.055 → 0.001 on story pages).
- Lighthouse (mobile, simulated slow 4G, Workers build behind compression): performance 91–96, CLS ≈ 0, TBT 60–290 ms. On a first visit the largest element is the age screen's text.
