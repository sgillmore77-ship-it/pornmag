import { getDb } from "@/db/client";
import { recordClick } from "@/data/ads";
import { isBot } from "@/data/analytics";
import { getPublicationByHost } from "@/data/publications";
import { site } from "@/data/site";
import { isoDay } from "@/lib/format";
import { isStaffRequest } from "@/lib/staff-marker";

/** Counts a click on a direct-sold banner and sends the reader to the advertiser. */
export async function GET(req: Request, { params }: RouteContext<"/api/ads/click/[id]">) {
  const { id } = await params;
  const publication = await getPublicationByHost(req.headers.get("host") ?? "");
  if (!publication) return new Response("Not found", { status: 404 });
  const db = await getDb();
  const s = site(publication.id);
  const day = isoDay(new Date(), publication.settings.timeZone ?? "Europe/London");
  // Bots and staff follow the link without being counted.
  const url = await recordClick(db, s, id, day, !isBot(req.headers.get("user-agent")) && !isStaffRequest(req));
  if (!url) return new Response("Not found", { status: 404 });
  return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
