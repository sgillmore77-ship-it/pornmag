import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { AdSlot } from "@/components/mag/ad-slot";
import { kickerOf } from "@/components/mag/bits";
import { CardGrid, ListingCard } from "@/components/mag/listing-card";
import { Media } from "@/components/mag/media";
import { ScoreRing } from "@/components/mag/score";
import { RichText } from "@/components/rich-text";
import { ShareBar } from "@/components/share-bar";
import { getDb } from "@/db/client";
import { contentPath, getPublishedBySlug, listRelated, SECTION_FOR_TYPE, TYPE_FOR_SECTION } from "@/data/content";
import { formatDate, formatDuration } from "@/lib/format";
import { absoluteUrl, articleJsonLd, breadcrumbJsonLd, contentMetadata } from "@/lib/seo";
import { notFoundOrRedirect } from "@/lib/redirects";
import { getSiteContext } from "@/lib/site-context";

export const revalidate = 300;

// Rendered on first request, then cached and refreshed (ISR).
export async function generateStaticParams() {
  return [];
}

const SECTION_NAMES: Record<string, string> = { features: "Features", reviews: "Reviews", videos: "Videos", news: "News" };

async function load(params: PageProps<"/[site]/[section]/[slug]">["params"]) {
  const { site, section, slug } = await params;
  const ctx = await getSiteContext(site);
  const type = TYPE_FOR_SECTION[section];
  if (!type) return notFoundOrRedirect(ctx, `/${section}/${slug}`);
  const item = await getPublishedBySlug(await getDb(), ctx.site, type, decodeURIComponent(slug));
  if (!item) return notFoundOrRedirect(ctx, `/${section}/${slug}`);
  return { ctx, item, section };
}

export async function generateMetadata({ params }: PageProps<"/[site]/[section]/[slug]">) {
  const { ctx, item } = await load(params);
  return contentMetadata(ctx, item);
}

export default async function ContentPage({ params }: PageProps<"/[site]/[section]/[slug]">) {
  const { ctx, item, section } = await load(params);
  const tz = ctx.publication.settings.timeZone;
  const related = await listRelated(await getDb(), ctx.site, item.id, 4);
  const url = absoluteUrl(ctx, contentPath(item));
  const crumbs = [
    { name: ctx.publication.name, path: "/" },
    { name: SECTION_NAMES[section], path: `/${SECTION_FOR_TYPE[item.type]}` },
    { name: item.title, path: contentPath(item) },
  ];
  const byline = item.authorDetails.map((a) => a.name).join(" & ");

  return (
    <>
      <JsonLd data={[articleJsonLd(ctx, item), breadcrumbJsonLd(ctx, crumbs)]} />
      <article>
        <header className="wrap" style={{ paddingTop: "clamp(28px, 4.4cqw, 72px)", maxWidth: 1100, marginInline: "auto", textAlign: "center" }}>
          <div className="row-kicker label-mono" style={{ justifyContent: "center", gap: 14 }}>
            {item.category ? (
              <Link href={`/category/${item.category.slug}`} className="kicker">
                {kickerOf(item)}
              </Link>
            ) : (
              <span className="kicker">{kickerOf(item)}</span>
            )}
            <time dateTime={item.publishedAt.toISOString()} style={{ color: "var(--muted)" }}>
              {formatDate(item.publishedAt, tz)}
            </time>
          </div>
          <h1 className="disp" style={{ marginTop: 18, fontSize: "calc(clamp(42px, 6.2cqw, 96px) * var(--dsz))", marginInline: "auto", maxWidth: "16ch" }}>
            {item.title}
          </h1>
          {item.standfirst && (
            <p style={{ margin: "22px auto 0", maxWidth: 680, fontSize: "clamp(18px, 1.5cqw, 21px)", lineHeight: 1.55, color: "var(--muted)", textWrap: "pretty" }}>{item.standfirst}</p>
          )}
          <p className="meta" style={{ marginTop: 22 }}>
            {byline && <>By {byline} · </>}
            {item.type === "video" && item.video?.durationSeconds ? formatDuration(item.video.durationSeconds) : `${item.readMinutes} min read`}
          </p>
        </header>

        <figure className="wrap" style={{ marginTop: "clamp(28px, 3.6cqw, 52px)", maxWidth: 1312, marginInline: "auto" }}>
          <Media image={item.heroImage} ratio="16/9" sizes="(min-width: 1312px) 1184px, 100vw" priority>
            {item.type === "video" && <span className="play lg" />}
          </Media>
          {item.heroImage && (item.heroImage.caption || item.heroImage.credit) && !item.heroImage.storageKey.startsWith("placeholder:") && (
            <figcaption className="meta" style={{ marginTop: 10, textTransform: "none", letterSpacing: "0.04em" }}>
              {item.heroImage.caption} {item.heroImage.credit}
            </figcaption>
          )}
        </figure>

        {item.review && (
          <div className="wrap" style={{ maxWidth: 820, marginInline: "auto", marginTop: "clamp(28px, 3.6cqw, 48px)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center", justifyContent: "space-between", borderTop: "2px solid var(--ink)", borderBottom: "1px solid var(--line)", padding: "22px 0" }}>
              <ScoreRing score={item.review.score} scoreMax={item.review.scoreMax} badge={item.review.badge} />
              <span className="meta">{[item.review.studio, item.review.releaseYear].filter(Boolean).join(" · ")}</span>
            </div>
            {item.review.verdict && (
              <p className="disp" style={{ marginTop: 20, fontSize: "calc(clamp(24px, 2.4cqw, 32px) * var(--dsz))", lineHeight: 1.15 }}>
                {item.review.verdict}
              </p>
            )}
          </div>
        )}

        <div className="wrap article-grid" style={{ marginTop: "clamp(32px, 4cqw, 56px)" }}>
          <aside aria-label="Share" className="article-share">
            <ShareBar url={url} title={item.title} />
          </aside>
          <div style={{ minWidth: 0 }}>
            <RichText doc={item.body} insertAfterParagraph={{ n: 4, node: <div className="ad-inline"><AdSlot slot="in_content" ctx={ctx} /></div> }} />
            {item.tags.length > 0 && (
              <ul aria-label="Tags" style={{ listStyle: "none", padding: 0, margin: "48px 0 0", display: "flex", flexWrap: "wrap", gap: 8 }}>
                {item.tags.map((t) => (
                  <li key={t.id} className="chip" style={{ fontSize: 11, padding: "6px 10px" }}>
                    {t.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section aria-labelledby="related" className="wrap sec" style={{ marginTop: "clamp(32px, 4cqw, 64px)" }}>
          <div className="sh">
            <h2 id="related" className="disp">
              More to read
            </h2>
          </div>
          <CardGrid>
            {related.map((r) => (
              <ListingCard key={r.id} item={r} tz={tz} />
            ))}
          </CardGrid>
        </section>
      )}

      <nav aria-label="Breadcrumb" className="wrap meta" style={{ marginTop: 24 }}>
        <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {crumbs.slice(0, -1).map((c) => (
            <li key={c.path}>
              <Link href={c.path}>{c.name}</Link> /
            </li>
          ))}
          <li aria-current="page" style={{ color: "var(--ink)" }}>
            {item.title}
          </li>
        </ol>
      </nav>
    </>
  );
}
