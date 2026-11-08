/**
 * Cloudflare Worker entry: host rules (www redirect, noindex on workers.dev),
 * the OpenNext app, plus a Cron handler that publishes scheduled stories.
 * The cron calls the app's own endpoint so the work runs with the same code,
 * bindings and cache purging as the site.
 */
import { default as app } from "./.open-next/worker.js";
import { canonicalRedirect, isPreviewHost, parseHosts, withNoindex } from "./src/lib/edge-host";

type Env = { CRON_SECRET?: string; CANONICAL_HOSTS?: string; WORKER_SELF_REFERENCE: { fetch: typeof fetch } };

export default {
  async fetch(request: Request, env: Env, ctx: unknown) {
    const redirect = canonicalRedirect(request, parseHosts(env.CANONICAL_HOSTS));
    if (redirect) return redirect;
    const response = await (app.fetch as (r: Request, e: Env, c: unknown) => Promise<Response>)(request, env, ctx);
    return isPreviewHost(request) ? withNoindex(response) : response;
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
