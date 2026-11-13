import "server-only";
import { getDb, type Db } from "@/db/client";
import { getPublicationByHost, type Publication } from "@/data/publications";
import { site, type Site } from "@/data/site";
import { isBot } from "@/data/analytics";
import { isoDay } from "./format";
import { isStaffRequest } from "./staff-marker";

/**
 * Shared checks for the counting endpoints: a known publication, a request
 * from its own pages (not another site), not a bot, and not from staff.
 */
export async function beaconContext(req: Request): Promise<{ db: Db; s: Site; publication: Publication; host: string; day: string } | null> {
  const host = req.headers.get("host") ?? "";
  const origin = req.headers.get("origin");
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return null;
  if (origin) {
    try {
      if (new URL(origin).host !== host) return null;
    } catch {
      return null;
    }
  }
  if (isBot(req.headers.get("user-agent"))) return null;
  if (isStaffRequest(req)) return null;
  const publication = await getPublicationByHost(host);
  if (!publication) return null;
  return { db: await getDb(), s: site(publication.id), publication, host, day: isoDay(new Date(), publication.settings.timeZone ?? "Europe/London") };
}

export async function readJson(req: Request, maxBytes = 4096): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const noContent = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
