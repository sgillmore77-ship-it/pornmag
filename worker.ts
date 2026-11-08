/**
 * Cloudflare Worker entry: country blocking, the OpenNext app, plus a Cron handler that
 * publishes scheduled stories. The cron calls the app's own endpoint so the
 * work runs with the same code, bindings and cache purging as the site.
 */
import { default as app } from "./.open-next/worker.js";
import { geoBlock, parseCountries } from "./src/lib/geo-block";

type Env = { CRON_SECRET?: string; BETTER_AUTH_SECRET?: string; BLOCKED_COUNTRIES?: string; WORKER_SELF_REFERENCE: { fetch: typeof fetch } };

export default {
  // Country blocking runs first, so cached pages are never served to blocked visitors.
  async fetch(request: Request, env: Env, ctx: unknown) {
    const country = (request as Request & { cf?: { country?: string } }).cf?.country;
    const blocked = await geoBlock(request, country, parseCountries(env.BLOCKED_COUNTRIES), env.BETTER_AUTH_SECRET);
    if (blocked) return blocked;
    return (app.fetch as (r: Request, e: Env, c: unknown) => Promise<Response>)(request, env, ctx);
  },
  async scheduled(_event: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    if (!env.CRON_SECRET) {
      console.error("CRON_SECRET is not set; scheduled publishing is disabled");
      return;
    }
    ctx.waitUntil(
      env.WORKER_SELF_REFERENCE.fetch(
        new Request("https://localhost/api/cron/publish", { method: "POST", headers: { authorization: `Bearer ${env.CRON_SECRET}` } }),
      ).then(async (r) => console.log("scheduled publish:", r.status, await r.text())),
    );
  },
};

// Durable Objects used by the OpenNext cache.
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";
