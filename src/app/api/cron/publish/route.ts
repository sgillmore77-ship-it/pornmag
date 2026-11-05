import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/db/client";
import { publishDue } from "@/data/admin/content";
import { purgeSite } from "@/lib/admin";

/**
 * Publishes scheduled stories whose time has come, for every publication,
 * and refreshes those sites' caches. Called every 5 minutes by the Cloudflare
 * Cron trigger (see worker.ts). Protected by CRON_SECRET.
 */
function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!authorised(req)) return new Response("Unauthorised", { status: 401 });
  const db = await getDb();
  const published = await publishDue(db);
  const pubs = [...new Set(published.map((p) => p.publicationId))];
  for (const id of pubs) purgeSite(id);
  return Response.json({ published: published.length, publications: pubs.length });
}
