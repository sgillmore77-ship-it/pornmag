import Link from "next/link";
import type { Metadata } from "next";
import { CardGrid, ListingCard } from "@/components/mag/listing-card";
import { getDb } from "@/db/client";
import type { ContentType } from "@/data/content";
import { search } from "@/lib/search";
import { getSiteContext } from "@/lib/site-context";

// Results depend on the query, so this page is rendered per request and kept out of search engines.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Search", robots: { index: false, follow: true } };

const FILTERS: { key: string; label: string; types?: ContentType[] }[] = [
  { key: "", label: "Everything" },
  { key: "features", label: "Features", types: ["article"] },
  { key: "reviews", label: "Reviews", types: ["review"] },
  { key: "videos", label: "Videos", types: ["video"] },
  { key: "news", label: "News", types: ["news"] },
];
const PAGE = 24;

export default async function SearchPage({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ q?: string; type?: string; page?: string }> }) {
  const ctx = await getSiteContext((await params).site);
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 120);
  const filter = FILTERS.find((f) => f.key === (sp.type ?? "")) ?? FILTERS[0];
  const page = Math.max(1, Math.min(50, Number(sp.page) || 1));
  const result = q.trim() ? await search.search(await getDb(), ctx.site, { q, types: filter.types, limit: PAGE, offset: (page - 1) * PAGE }) : null;
  const href = (over: Record<string, string>) => {
    const p = new URLSearchParams({ q, ...(filter.key ? { type: filter.key } : {}), ...over });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `/search?${p}`;
  };

  return (
    <div className="wrap" style={{ paddingTop: "clamp(28px, 4cqw, 64px)" }}>
      <form action="/search" role="search" style={{ borderTop: "2px solid var(--ink)", paddingTop: 16 }}>
        <label htmlFor="q" className="kicker">
          Search {ctx.publication.name}
        </label>
        <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            autoFocus={!q}
            maxLength={120}
            placeholder="Stories, reviews, studios…"
            className="disp"
            style={{ flex: "1 1 320px", fontSize: "calc(clamp(28px, 3.4cqw, 48px) * var(--dsz))", border: 0, borderBottom: "1px solid var(--line)", background: "transparent", color: "var(--ink)", padding: "8px 0", outline: "none", borderRadius: 0 }}
          />
          {filter.key && <input type="hidden" name="type" value={filter.key} />}
          <button className="btn btn-primary btn-lg">Search</button>
        </div>
      </form>

      {result && (
        <>
          <nav aria-label="Filter results" className="rail label-mono" style={{ gap: 24, margin: "28px 0 8px", borderBottom: "1px solid var(--line)" }}>
            {FILTERS.map((f) => (
              <Link key={f.key} href={href({ type: f.key, page: "" })} aria-current={f.key === filter.key ? "page" : undefined} style={{ padding: "10px 0", borderBottom: f.key === filter.key ? "2px solid var(--brand)" : "2px solid transparent" }}>
                {f.label}
              </Link>
            ))}
          </nav>
          <p className="meta" style={{ margin: "16px 0 28px" }} role="status">
            {result.total === 0 ? `No results for “${q}”` : `${result.total} result${result.total === 1 ? "" : "s"} for “${q}”`}
          </p>
          {result.categories.length > 0 && (
            <div className="toolbar" style={{ marginBottom: 28 }}>
              <span className="meta">Categories:</span>
              {result.categories.map((c) => (
                <Link key={c.slug} href={`/category/${c.slug}`} className="chip" style={{ fontSize: 11, padding: "6px 10px" }}>
                  {c.name}
                </Link>
              ))}
            </div>
          )}
          {result.items.length > 0 ? (
            <CardGrid>
              {result.items.map((item) => (
                <ListingCard key={item.id} item={item} tz={ctx.publication.settings.timeZone} headingLevel={2} />
              ))}
            </CardGrid>
          ) : (
            <p className="dek" style={{ fontSize: 18 }}>
              Try fewer or different words, or browse <Link href="/features" className="underline">features</Link> and <Link href="/reviews" className="underline">reviews</Link>.
            </p>
          )}
          {(page > 1 || page * PAGE < result.total) && (
            <nav aria-label="Pagination" className="label-mono" style={{ marginTop: 48, display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--line)", paddingTop: 20 }}>
              {page > 1 ? <Link href={href({ page: String(page - 1) })}>← Previous</Link> : <span />}
              {page * PAGE < result.total ? <Link href={href({ page: String(page + 1) })}>Next →</Link> : <span />}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
