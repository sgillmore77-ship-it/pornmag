/**
 * The proxy puts the request's host into the first path segment so pages
 * under app/[site] know which publication to render. Routers treat dots
 * (file extensions) and colons (parameters) specially, so the host is
 * written with `.` → `~` and `:` → `_`. Neither character can appear in a
 * real hostname, so the mapping is unambiguous.
 *
 *   mag.example.com  ->  mag~example~com
 *   localhost:3000   ->  localhost_3000
 */
const HOST = /^[a-z0-9.-]+(:\d{1,5})?$/;

export function hostToSegment(host: string): string | null {
  const h = host.trim().toLowerCase();
  return HOST.test(h) ? h.replace(/\./g, "~").replace(":", "_") : null;
}

export function segmentToHost(segment: string): string {
  return decodeURIComponent(segment).replace(/~/g, ".").replace("_", ":");
}
