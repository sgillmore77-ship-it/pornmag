import { getSiteContext } from "@/lib/site-context";

// Generated per request (no database access at build time) and cached at the edge.
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: RouteContext<"/[site]/robots.txt">) {
  const ctx = await getSiteContext((await params).site);
  // Preview deployments must never be indexed.
  const preview = ctx.host.endsWith(".workers.dev") || ctx.origin.startsWith("http://");
  const body = preview
    ? "User-agent: *\nDisallow: /\n"
    : `User-agent: *\nAllow: /\nDisallow: /account\nDisallow: /login\nDisallow: /register\nDisallow: /forgot-password\nDisallow: /reset-password\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${ctx.origin}/sitemap.xml\n`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=3600" } });
}
