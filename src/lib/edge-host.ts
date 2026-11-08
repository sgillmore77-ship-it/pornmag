/**
 * Host rules that run in the Worker before the app (and before cached pages):
 *
 * - `www.<canonical>` is sent to `<canonical>` with a permanent redirect, for
 *   each host listed in the CANONICAL_HOSTS var (comma separated).
 * - Responses on `*.workers.dev` get `X-Robots-Tag: noindex`, so search
 *   engines only index the real domain. Staff can still use the address.
 *
 * Kept free of Worker and Next.js imports so it can be unit tested.
 */

export function parseHosts(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Returns a 301 to the canonical host, or null when no redirect applies. */
export function canonicalRedirect(request: Request, canonicalHosts: Set<string>): Response | null {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  if (!host.startsWith("www.")) return null;
  const bare = host.slice(4);
  if (!canonicalHosts.has(bare)) return null;
  url.hostname = bare;
  url.protocol = "https:";
  url.port = "";
  return new Response(null, { status: 301, headers: { location: url.toString(), "cache-control": "public, max-age=86400" } });
}

export function isPreviewHost(request: Request): boolean {
  return new URL(request.url).hostname.toLowerCase().endsWith(".workers.dev");
}

/** Adds `X-Robots-Tag: noindex` without touching the original response. */
export function withNoindex(response: Response): Response {
  const out = new Response(response.body, response);
  out.headers.set("x-robots-tag", "noindex");
  return out;
}
