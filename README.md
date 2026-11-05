# Magazine platform

An editorial publishing platform for an adult culture and entertainment magazine, built so that it can later host many independent publications (multi-tenant SaaS).

- **Stack:** Next.js 16, TypeScript, Tailwind CSS 4, PostgreSQL (Supabase) with Drizzle ORM, Better Auth, deployed to Cloudflare Workers.
- **Status:** Phase 1A is complete (foundations, auth, homepage, articles). The visual design is provisional until the Claude Design system is applied.

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): decisions and reasoning (tenancy, content model, caching, SEO, security).
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): accounts and steps to go live, and local development.

## Quick start

```
cp .env.example .env
npm install
npm run db:migrate && npm run db:seed
npm run dev
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm test` | Test suite (needs `TEST_DATABASE_URL`) |
| `npm run typecheck` / `npm run lint` | Static checks |
| `npm run db:generate` | Create a migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Load sample content |
| `npm run preview` | Build and run in Cloudflare's runtime locally |
| `npm run deploy` | Build and deploy to Cloudflare |

## Layout

```
src/
  app/[site]/        public site; [site] is the publication's host, set by src/proxy.ts
  app/api/auth/      authentication endpoints
  components/        UI components
  data/              publication-scoped data access (all reads go through here)
  db/schema.ts       database schema for all phases
  lib/               auth, permissions, SEO, theming, media helpers
drizzle/             SQL migrations
scripts/seed.ts      sample data
tests/               tenant isolation, visibility, auth and security tests
```
