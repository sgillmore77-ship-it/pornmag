import { getSiteContext } from "@/lib/site-context";

export const dynamic = "force-dynamic";

/** Authorised digital sellers, pasted from the site's ad networks (Ads → ads.txt). */
export async function GET(_req: Request, { params }: RouteContext<"/[site]/ads.txt">) {
  const ctx = await getSiteContext((await params).site);
  const body = ctx.publication.settings.ads?.adsTxt?.trim();
  if (!body) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=600" } });
  return new Response(`${body}\n`, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=3600" } });
}
