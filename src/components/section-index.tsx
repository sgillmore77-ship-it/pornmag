import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDb } from "@/db/client";
import { getCategoryBySlug, listPublished, TYPE_FOR_SECTION, type ContentType } from "@/data/content";
import { getSiteContext } from "@/lib/site-context";
import { CardGrid, ListingCard } from "./mag/listing-card";

export const PAGE_SIZE = 24;

const TITLES: Record<string, { title: string; dek: string }> = {
  features: { title: "Features", dek: "Reporting, interviews, essays and criticism." },
  reviews: { title: "Reviews", dek: "New releases, rated out of five." },
  videos: { title: "Latest videos", dek: "Curated releases from our partner studios." },
  news: { title: "The Wire", dek: "Industry news as it happens." },
};

type Listing = { kind: "section"; section: string } | { kind: "category"; slug: string };

function basePath(l: Listing) {
  return l.kind === "section" ? `/${l.section}` : `/category/${l.slug}`;
}
function pageHref(l: Listing, page: number) {
  return page <= 1 ? basePath(l) : `${basePath(l)}/page/${page}`;
}

async function resolve(site: string, l: Listing) {
  const ctx = await getSiteContext(site);
  if (l.kind === "section") {
    const type = TYPE_FOR_SECTION[l.section];
    if (!type) notFound();
    return { ctx, filter: { types: [type] as ContentType[] }, ...TITLES[l.section], indexable: true, intro: null as string | null };
  }
  const cat = await getCategoryBySlug(await getDb(), ctx.site, l.slug);
  if (!cat) notFound();
  return {
    ctx,
    filter: { categoryId: cat.id },
    title: cat.name,
    dek: null as string | null,
    intro: cat.intro,
    indexable: cat.indexable,
    seoTitle: cat.seoTitle,
    metaDescription: cat.metaDescription,
  };
}

export async function listingMetadata(site: string, l: Listing, page: number): Promise<Metadata> {
  const r = await resolve(site, l);
  const base = ("seoTitle" in r && r.seoTitle) || r.title;
  return {
    title: page > 1 ? `${base} — page ${page}` : base,
    description: ("metaDescription" in r && r.metaDescription) || r.intro || r.dek || undefined,
    alternates: { canonical: pageHref(l, page) },
    robots: r.indexable ? undefined : { index: false, follow: true },
  };
}

/** Paginated listing, e.g. /reviews, /reviews/page/2, /category/blonde. */
export async function Listing({ site, listing, page }: { site: string; listing: Listing; page: number }) {
  if (!Number.isInteger(page) || page < 1) notFound();
  const r = await resolve(site, listing);
  const items = await listPublished(await getDb(), r.ctx.site, { ...r.filter, limit: PAGE_SIZE + 1, offset: (page - 1) * PAGE_SIZE });
  if (page > 1 && items.length === 0) notFound();
  const hasNext = items.length > PAGE_SIZE;
  const shown = items.slice(0, PAGE_SIZE);
  const tz = r.ctx.publication.settings.timeZone;

  return (
    <div className="wrap" style={{ paddingTop: "clamp(28px, 4cqw, 64px)" }}>
      <header style={{ borderTop: "2px solid var(--ink)", paddingTop: 16, marginBottom: "clamp(28px, 3.6cqw, 52px)" }}>
        {listing.kind === "category" && <p className="kicker">Category</p>}
        <h1 className="disp" style={{ fontSize: "calc(clamp(44px, 6.4cqw, 96px) * var(--dsz))", marginTop: 6 }}>
          {r.title}
        </h1>
        {(r.intro || r.dek) && <p style={{ marginTop: 14, maxWidth: 680, fontSize: "clamp(17px, 1.35cqw, 19px)", lineHeight: 1.55, color: "var(--muted)" }}>{r.intro ?? r.dek}</p>}
      </header>
      {shown.length === 0 ? (
        <p className="dek">Nothing here yet.</p>
      ) : (
        <CardGrid>
          {shown.map((item, i) => (
            <ListingCard key={item.id} item={item} tz={tz} headingLevel={2} priority={page === 1 && i < 2} />
          ))}
        </CardGrid>
      )}
      {(page > 1 || hasNext) && (
        <nav aria-label="Pagination" className="label-mono" style={{ marginTop: 64, display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--line)", paddingTop: 20 }}>
          {page > 1 ? (
            <Link href={pageHref(listing, page - 1)} rel="prev">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          {hasNext ? (
            <Link href={pageHref(listing, page + 1)} rel="next">
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
