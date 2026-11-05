/**
 * Direction 1a, "The Feed": grid-led and discovery-first.
 * Markup and measurements follow design_handoff_editorial_homepage/Home Feed.
 */
import Link from "next/link";
import { contentPath, type ContentCard } from "@/data/content";
import type { ResolvedSection } from "@/data/homepage";
import { formatDate, formatDuration, formatNewsTime } from "@/lib/format";
import type { SiteContext } from "@/lib/site-context";
import { AdSlot } from "./ad-slot";
import { bylineOf, countLabel, KickerDate, kickerOf, SectionHead, trendingMeta } from "./bits";
import { Media } from "./media";
import { ScoreBlock, ScoreInline } from "./score";

type ItemsSection = Extract<ResolvedSection, { items: ContentCard[] }>;
type CategoriesSection = Extract<ResolvedSection, { kind: "categories" }>;
type Props<K extends ResolvedSection["kind"]> = { section: K extends "categories" ? CategoriesSection : ItemsSection; ctx: SiteContext; first: boolean };

const tzOf = (ctx: SiteContext) => ctx.publication.settings.timeZone;

function Hero({ section, ctx, first }: Props<"hero">) {
  const item = section.items[0];
  const href = contentPath(item);
  return (
    <section className="wrap" aria-label={section.title ?? "Cover story"} style={{ paddingTop: "clamp(20px, 2.8cqw, 40px)", paddingBottom: "clamp(36px, 4cqw, 64px)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "clamp(20px, 3.3cqw, 56px)", alignItems: "stretch" }}>
        <Link href={href} tabIndex={-1} aria-hidden style={{ flex: "1.65 1 560px" }}>
          <Media image={item.heroImage} ratio="4/3" sizes="(min-width: 1024px) 62vw, 100vw" priority={first} />
        </Link>
        <div style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: "clamp(14px, 1.6cqw, 22px)", paddingBottom: 4 }}>
          <div className="row-kicker label-mono" style={{ gap: 14 }}>
            <span className="kicker">{kickerOf(item)}</span>
            <span style={{ color: "var(--muted)" }}>{formatDate(item.publishedAt, tzOf(ctx))}</span>
          </div>
          <h2 className="disp" style={{ fontSize: "calc(clamp(42px, 5.2cqw, 80px) * var(--dsz))" }}>
            <Link href={href}>{item.title}</Link>
          </h2>
          {item.standfirst && <p style={{ fontSize: "clamp(17px, 1.35cqw, 19px)", lineHeight: 1.55, color: "var(--muted)", textWrap: "pretty" }}>{item.standfirst}</p>}
          <div className="meta">
            By {bylineOf(item)} · {item.readMinutes} min read
          </div>
          <Link href={href} className="btn btn-outline" style={{ alignSelf: "flex-start", marginTop: 6, fontSize: 14 }}>
            Read the feature →
          </Link>
        </div>
      </div>
    </section>
  );
}

function StoryCard({ item, ctx }: { item: ContentCard; ctx: SiteContext }) {
  return (
    <Link href={contentPath(item)} className="card story-card">
      <Media image={item.heroImage} ratio="3/2" sizes="(min-width: 1024px) 30vw, (min-width: 700px) 45vw, 100vw" className="sc-img" />
      <div className="sc-kicker">
        <KickerDate item={item} tz={tzOf(ctx)} />
      </div>
      <h3 className="disp card-title sc-title" style={{ lineHeight: 1.08, fontSize: "calc(27px * var(--dsz))" }}>
        {item.title}
      </h3>
      {item.standfirst && <p className="dek sc-dek">{item.standfirst}</p>}
      <span className="meta sc-by">By {bylineOf(item)}</span>
    </Link>
  );
}

function Latest({ section, ctx }: Props<"latest">) {
  return (
    <section className="wrap sec">
      <SectionHead title={section.title ?? "Latest stories"} link={{ href: "/features", label: "View all →" }} />
      <div className="feed-latest">
        {section.items.map((item) => (
          <StoryCard key={item.id} item={item} ctx={ctx} />
        ))}
      </div>
    </section>
  );
}

function Reviews({ section }: Props<"featured_reviews">) {
  return (
    <section className="wrap sec-tint">
      <SectionHead title={section.title ?? "Reviews"} sub="This week's releases, rated out of five." link={{ href: "/reviews", label: "All reviews →" }} />
      <div className="rail-cards" style={{ gridAutoColumns: "minmax(268px, 1fr)" }}>
        {section.items.map((r) => (
          <Link key={r.id} href={contentPath(r)} className="card" style={{ display: "flex", flexDirection: "column", gap: 10, scrollSnapAlign: "start" }}>
            <Media image={r.heroImage} ratio="4/5" sizes="(min-width: 1024px) 23vw, 70vw" label="top-right">
              {r.review && <ScoreBlock score={r.review.score} scoreMax={r.review.scoreMax} />}
            </Media>
            {r.review?.badge && (
              <span className="kicker" style={{ marginTop: 4 }}>
                ● {r.review.badge}
              </span>
            )}
            <h3 className="disp card-title" style={{ lineHeight: 1.05, fontSize: "calc(28px * var(--dsz))" }}>
              {r.title}
            </h3>
            <span className="meta">{[r.review?.studio, r.review?.releaseYear].filter(Boolean).join(" · ")}</span>
            {r.review?.verdict && <p style={{ fontSize: 16, lineHeight: 1.5, textWrap: "pretty" }}>{r.review.verdict}</p>}
          </Link>
        ))}
      </div>
    </section>
  );
}

function Trending({ section, ctx }: Props<"trending">) {
  return (
    <section className="wrap sec">
      <div className="sh" style={{ marginBottom: "clamp(10px, 1.4cqw, 20px)" }}>
        <div>
          <h2 className="disp">{section.title ?? "Trending"}</h2>
          <span className="sh-sub">Stories and video, last 24 hours.</span>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "clamp(28px, 3.3cqw, 48px)", alignItems: "flex-start" }}>
        <ol className="two-col" style={{ flex: "1 1 600px", columnGap: 40 }}>
          {section.items.map((t, i) => (
            <li key={t.id} style={{ borderBottom: "1px solid var(--line)" }}>
              <Link href={contentPath(t)} className="card" style={{ display: "grid", gridTemplateColumns: "44px minmax(0,1fr) 96px", gap: 16, alignItems: "start", padding: "18px 0" }}>
                <span aria-hidden style={{ fontFamily: "var(--fd)", fontWeight: "var(--dw)" as unknown as number, lineHeight: 0.9, fontSize: "calc(44px * var(--dsz))", color: "var(--brand-text)" }}>
                  {i + 1}
                </span>
                <span style={{ display: "flex", flexDirection: "column", gap: 7, alignItems: "flex-start" }}>
                  <span className="chip">{t.type === "video" ? "▶ Video" : "Article"}</span>
                  <span className="disp card-title" style={{ lineHeight: 1.12, fontSize: "calc(21px * var(--dsz))" }}>
                    {t.title}
                  </span>
                  <span className="meta">{trendingMeta(t)}</span>
                </span>
                <Media image={t.heroImage} ratio="1/1" sizes="96px" label="none">
                  {t.type === "video" && <span className="play sm" />}
                </Media>
              </Link>
            </li>
          ))}
        </ol>
        {ctx.ads.slots.includes("sidebar") && (
          <aside style={{ flex: "0 0 300px", marginInline: "auto", paddingTop: 18 }}>
            <AdSlot slot="sidebar" ctx={ctx} align="left" />
          </aside>
        )}
      </div>
    </section>
  );
}

function VideoCard({ v }: { v: ContentCard }) {
  return (
    <Link href={contentPath(v)} className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Media image={v.heroImage} ratio="16/10" sizes="(min-width: 1024px) 23vw, 50vw" label="top-left" labelPrefix="">
        <span className="play" />
        {v.video?.durationSeconds ? <span className="dur">{formatDuration(v.video.durationSeconds)}</span> : null}
      </Media>
      <h3 className="disp card-title" style={{ lineHeight: 1.1, fontSize: "calc(clamp(18px, 1.6cqw, 23px) * var(--dsz))" }}>
        {v.title}
      </h3>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "4px 10px" }}>
        <span className="meta" style={{ letterSpacing: "0.08em" }}>
          {v.video?.studio ?? ""}
        </span>
        {v.review && <ScoreInline score={v.review.score} scoreMax={v.review.scoreMax} />}
      </div>
    </Link>
  );
}

function Videos({ section, ctx }: Props<"featured_videos">) {
  const rowA = section.items.slice(0, 4);
  const rowB = section.items.slice(4);
  return (
    <section className="wrap band-dark" style={{ paddingBlock: "clamp(40px, 4.5cqw, 72px)" }}>
      <SectionHead title={section.title ?? "Featured video"} link={{ href: "/videos", label: "Browse all →" }} />
      <div className="video-grid">
        {rowA.map((v) => (
          <VideoCard key={v.id} v={v} />
        ))}
        {rowB.length > 0 && ctx.ads.slots.includes("between_grid") && (
          <div style={{ gridColumn: "1 / -1", padding: "8px 0" }}>
            <AdSlot slot="between_grid" ctx={ctx} />
          </div>
        )}
        {rowB.map((v) => (
          <VideoCard key={v.id} v={v} />
        ))}
      </div>
    </section>
  );
}

function Picks({ section }: Props<"editors_picks">) {
  return (
    <section className="wrap sec">
      <SectionHead title={section.title ?? "Editor's picks"} sub={section.items.length === 3 ? "Three things worth your evening." : undefined} />
      <div className="rail-cards" style={{ gridAutoColumns: "minmax(282px, 1fr)" }}>
        {section.items.map((p) => (
          <Link key={p.id} href={contentPath(p)} className="card" style={{ display: "flex", flexDirection: "column", gap: 12, scrollSnapAlign: "start" }}>
            <Media image={p.heroImage} ratio="4/5" sizes="(min-width: 1024px) 31vw, 75vw">
              <span className="chip chip-brand" style={{ position: "absolute", top: 0, left: 0 }}>
                Editor&apos;s pick
              </span>
            </Media>
            <span className="kicker" style={{ marginTop: 4 }}>
              {kickerOf(p)}
            </span>
            <h3 className="disp card-title" style={{ lineHeight: 1.05, fontSize: "calc(clamp(26px, 2.2cqw, 32px) * var(--dsz))" }}>
              {p.title}
            </h3>
            {p.standfirst && <p className="dek">{p.standfirst}</p>}
            <span className="meta">By {bylineOf(p)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Categories({ section }: Props<"categories">) {
  return (
    <section className="wrap sec">
      <SectionHead title={section.title ?? "Popular categories"} />
      <div className="cat-grid">
        {section.categories.map((k) => (
          <Link key={k.id} href={`/category/${k.slug}`} className="cat-tile">
            <Media image={k.image} ratio="3/4" sizes="(min-width: 1024px) 16vw, 45vw" label="none" style={{ position: "absolute", inset: 0 }} />
            {k.image?.caption && (
              <span aria-hidden style={{ position: "absolute", left: 14, right: 14, top: 12, fontFamily: "var(--fm)", fontSize: 9, lineHeight: 1.4, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,.55)" }}>
                {k.image.caption}
              </span>
            )}
            <span className="disp" style={{ position: "relative", lineHeight: 1, fontSize: "calc(clamp(24px, 2cqw, 30px) * var(--dsz))" }}>
              {k.name}
            </span>
            <span style={{ position: "relative", fontFamily: "var(--fm)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,.75)" }}>
              {countLabel(k.count)}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function News({ section, ctx }: Props<"latest_news">) {
  return (
    <section className="wrap sec">
      <div style={{ display: "flex", flexWrap: "wrap", gap: "clamp(28px, 3.3cqw, 48px)", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 600px" }}>
          <div className="sh" style={{ marginBottom: 8 }}>
            <h2 className="disp">{section.title ?? "Latest news"}</h2>
            <Link href="/news" className="sh-link">
              All news →
            </Link>
          </div>
          {section.items.map((n) => (
            <Link key={n.id} href={contentPath(n)} className="card" style={{ display: "grid", gridTemplateColumns: "clamp(64px, 7cqw, 96px) minmax(0,1fr)", gap: 16, padding: "15px 0", borderBottom: "1px solid var(--line)", alignItems: "baseline" }}>
              <time dateTime={n.publishedAt.toISOString()} style={{ fontFamily: "var(--fm)", fontSize: 12, color: "var(--muted)" }}>
                {formatNewsTime(n.publishedAt, tzOf(ctx))}
              </time>
              <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span className="kicker" style={{ fontSize: 10 }}>
                  {kickerOf(n)}
                </span>
                <span className="card-title" style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.35 }}>
                  {n.title}
                </span>
              </span>
            </Link>
          ))}
        </div>
        {ctx.ads.slots.includes("in_content") && (
          <aside style={{ flex: "0 0 300px", marginInline: "auto", paddingTop: 16 }}>
            <AdSlot slot="in_content" ctx={ctx} align="left" />
          </aside>
        )}
      </div>
    </section>
  );
}

export function FeedSection({ section, ctx, first }: { section: ResolvedSection; ctx: SiteContext; first: boolean }) {
  switch (section.kind) {
    case "hero":
      return <Hero section={section} ctx={ctx} first={first} />;
    case "latest":
      return <Latest section={section} ctx={ctx} first={first} />;
    case "featured_reviews":
      return <Reviews section={section} ctx={ctx} first={first} />;
    case "trending":
      return <Trending section={section} ctx={ctx} first={first} />;
    case "featured_videos":
      return <Videos section={section} ctx={ctx} first={first} />;
    case "editors_picks":
      return <Picks section={section} ctx={ctx} first={first} />;
    case "categories":
      return <Categories section={section} ctx={ctx} first={first} />;
    case "latest_news":
      return <News section={section} ctx={ctx} first={first} />;
    default:
      return null;
  }
}
