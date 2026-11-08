/** A short name for a partner feed link, e.g. "txxx.com · Asian, Japanese". */
export function feedLabel(feedUrl: string): string {
  const u = new URL(feedUrl);
  const cats = (u.searchParams.get("categories") ?? "").split(",").map((c) => c.trim()).filter(Boolean);
  const host = u.hostname.replace(/^www\./, "");
  return cats.length ? `${host} · ${cats.slice(0, 3).join(", ")}${cats.length > 3 ? ` +${cats.length - 3}` : ""}` : `${host} · all videos`;
}
