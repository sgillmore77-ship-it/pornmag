import { getDb } from "@/db/client";
import { contentPath, listSitemapEntries, SECTION_FOR_TYPE } from "@/data/content";
import { getSiteContext } from "@/lib/site-context";

// Generated per request (no database access at build time) and cached at the edge.
export const dynamic = "force-dynamic";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * One sitemap per publication. Only live, indexable content that is its own
 * canonical is listed. If a site passes ~45k URLs this becomes a sitemap index.
 */
export async function GET(_req: Request, { params }: RouteContext<"/[site]/sitemap.xml">) {
  const ctx = await getSiteContext((await params).site);
  const entries = await listSitemapEntries(await getDb(), ctx.site);

  const urls = [
    { loc: `${ctx.origin}/`, lastmod: entries[0]?.updatedAt },
    ...Object.values(SECTION_FOR_TYPE).map((s) => ({ loc: `${ctx.origin}/${s}`, lastmod: undefined })),
    ...entries.map((e) => ({ loc: `${ctx.origin}${contentPath(e)}`, lastmod: e.updatedAt })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod.toISOString()}</lastmod>` : ""}</url>`)
  .join("\n")}
</urlset>`;

  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=3600" } });
}
