/**
 * Direction 1b, "The Issue": cover-led and art-directed.
 * Markup and measurements follow design_handoff_editorial_homepage/Home Issue.
 */
import Link from "next/link";
import { contentPath, type ContentCard } from "@/data/content";
import type { ResolvedSection } from "@/data/homepage";
import { formatDate, formatDuration, formatNewsTime } from "@/lib/format";
import type { SiteContext } from "@/lib/site-context";
import { AdSlot } from "./ad-slot";
import { bylineOf, countLabel, KickerDate, kickerOf, SectionHead, trendingMeta } from "./bits";
import { Media } from "./media";
import { ScoreCompact, ScoreRing, Stars } from "./score";

type ItemsSection = Extract<ResolvedSection, { items: ContentCard[] }>;
type CategoriesSection = Extract<ResolvedSection, { kind: "categories" }>;
type Props<K extends ResolvedSection["kind"]> = { section: K extends "categories" ? CategoriesSection : ItemsSection; ctx: SiteContext; first: boolean };

const tzOf = (ctx: SiteContext) => ctx.publication.settings.timeZone;
const D = { fontFamily: "var(--fd)", fontWeight: "var(--dw)" as unknown as number };

function Hero({ section, ctx, first }: Props<"hero">) {
  const item = section.items[0];
  return (
    <section className="wrap" aria-label={section.title ?? "Cover story"} style={{ paddingTop: "clamp(20px, 2.8cqw, 40px)", paddingBottom: "clamp(36px, 4cqw, 64px)" }}>
      <Link href={contentPath(item)} className="card cover" style={{ position: "relative", display: "block", height: "clamp(560px, 52cqw, 780px)", color: "#fff", overflow: "hidden" }}>
        <Media image={item.heroImage} sizes="100vw" priority={first} label="top-right" labelPrefix="IMG · Cover · " style={{ position: "absolute", inset: 0 }} />
        <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(10,9,9,.82) 0%, rgba(10,9,9,0) 62%)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "clamp(22px, 3.6cqw, 56px)", display: "flex", flexDirection: "column", gap: "clamp(14px, 1.6cqw, 22px)" }}>
          <div className="row-kicker label-mono" style={{ gap: 14 }}>
            <span style={{ background: "var(--brand)", color: "var(--on-brand)", padding: "6px 10px" }}>Cover story · {kickerOf(item)}</span>
            <span>{formatDate(item.publishedAt, tzOf(ctx))}</span>
          </div>
          <h2 className="disp" style={{ maxWidth: "12ch", lineHeight: 0.94, fontSize: "calc(clamp(48px, 8.6cqw, 132px) * var(--dsz))" }}>
            {item.title}
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px 48px", alignItems: "flex-end", justifyContent: "space-between" }}>
            {item.standfirst && <p style={{ flex: "1 1 320px", maxWidth: 600, fontSize: "clamp(16px, 1.35cqw, 19px)", lineHeight: 1.5, color: "rgba(255,255,255,.88)" }}>{item.standfirst}</p>}
            <span className="label-mono" style={{ letterSpacing: "0.1em", color: "rgba(255,255,255,.78)" }}>
              Words {bylineOf(item)} · {item.readMinutes} min read
            </span>
          </div>
        </div>
      </Link>
    </section>
  );
}

function Latest({ section, ctx }: Props<"latest">) {
  const [lead, ...rest] = section.items;
  const mid = rest.slice(0, 2);
  const list = rest.slice(2, 5);
  return (
    <section className="wrap sec">
      <SectionHead title={section.title ?? "This week"} link={{ href: "/features", label: "Latest stories →" }} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: "clamp(28px, 3cqw, 44px)" }}>
        <Link href={contentPath(lead)} className="card" style={{ flex: "1.45 1 480px", display: "flex", flexDirection: "column", gap: 14 }}>
          <Media image={lead.heroImage} ratio="4/5" sizes="(min-width: 1024px) 40vw, 100vw" />
          <span style={{ marginTop: 6 }}>
            <KickerDate item={lead} tz={tzOf(ctx)} sep />
          </span>
          <h3 className="disp card-title" style={{ lineHeight: 1.02, fontSize: "calc(clamp(32px, 3.2cqw, 46px) * var(--dsz))" }}>
            {lead.title}
          </h3>
          {lead.standfirst && <p style={{ fontSize: 18, lineHeight: 1.55, color: "var(--muted)" }}>{lead.standfirst}</p>}
        </Link>
        {mid.length > 0 && (
          <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: "clamp(28px, 3cqw, 40px)" }}>
            {mid.map((s) => (
              <Link key={s.id} href={contentPath(s)} className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Media image={s.heroImage} ratio="3/2" sizes="(min-width: 1024px) 25vw, 100vw" />
                <span style={{ marginTop: 4 }}>
                  <KickerDate item={s} tz={tzOf(ctx)} sep />
                </span>
                <h3 className="disp card-title" style={{ lineHeight: 1.08, fontSize: "calc(25px * var(--dsz))" }}>
                  {s.title}
                </h3>
              </Link>
            ))}
          </div>
        )}
        {list.length > 0 && (
          <ol style={{ flex: "1 1 260px", margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column" }}>
            <li className="label-mono" style={{ paddingBottom: 12, borderBottom: "2px solid var(--ink)" }}>
              Also new
            </li>
            {list.map((s) => (
              <li key={s.id} style={{ borderBottom: "1px solid var(--line)" }}>
                <Link href={contentPath(s)} className="card" style={{ display: "flex", flexDirection: "column", gap: 6, padding: "18px 0" }}>
                  <span className="kicker">{kickerOf(s)}</span>
                  <span className="disp card-title" style={{ lineHeight: 1.1, fontSize: "calc(22px * var(--dsz))" }}>
                    {s.title}
                  </span>
                  {s.standfirst && <span style={{ fontSize: 15, lineHeight: 1.5, color: "var(--muted)" }}>{s.standfirst}</span>}
                  <span className="meta">By {bylineOf(s)}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function Reviews({ section }: Props<"featured_reviews">) {
  const [lead, ...rest] = section.items;
  const r = lead.review;
  return (
    <section className="wrap sec-tint">
      <SectionHead title={section.title ?? "Reviews"} link={{ href: "/reviews", label: "All reviews →" }} />
      <Link href={contentPath(lead)} className="card" style={{ display: "flex", flexWrap: "wrap", gap: "clamp(24px, 4cqw, 64px)", alignItems: "center", paddingBottom: "clamp(32px, 4cqw, 56px)", borderBottom: "1px solid var(--line)" }}>
        <Media image={lead.heroImage} ratio="4/3" sizes="(min-width: 1024px) 50vw, 100vw" style={{ flex: "1.2 1 460px" }} />
        <div style={{ flex: "1 1 340px", display: "flex", flexDirection: "column", gap: 18 }}>
          {r && <ScoreRing score={r.score} scoreMax={r.scoreMax} badge={r.badge} />}
          <h3 className="disp card-title" style={{ lineHeight: 1, fontSize: "calc(clamp(40px, 4.4cqw, 64px) * var(--dsz))" }}>
            {lead.title}
          </h3>
          <span className="meta">{[r?.studio, r?.releaseYear, lead.authors.length ? `Reviewed by ${bylineOf(lead)}` : null].filter(Boolean).join(" · ")}</span>
          {r?.verdict && <p style={{ fontSize: "clamp(18px, 1.5cqw, 21px)", lineHeight: 1.5, textWrap: "pretty" }}>{r.verdict}</p>}
        </div>
      </Link>
      {rest.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(max(280px, calc((100% - 2 * 40px) / 3)), 1fr))", gap: "0 40px" }}>
          {rest.map((x) => (
            <Link key={x.id} href={contentPath(x)} className="card" style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: 18, alignItems: "start", padding: "28px 0", borderBottom: "1px solid var(--line)" }}>
              {x.review ? <ScoreCompact score={x.review.score} scoreMax={x.review.scoreMax} /> : <span />}
              <span style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="disp card-title" style={{ lineHeight: 1.05, fontSize: "calc(26px * var(--dsz))" }}>
                  {x.title}
                </span>
                <span className="meta">{[x.review?.studio, x.review?.releaseYear].filter(Boolean).join(" · ")}</span>
                {x.review?.verdict && <span style={{ fontSize: 15, lineHeight: 1.5 }}>{x.review.verdict}</span>}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function Trending({ section, ctx }: Props<"trending">) {
  return (
    <section className="wrap sec">
      <div style={{ display: "flex", flexWrap: "wrap", gap: "clamp(28px, 3.3cqw, 56px)", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 600px" }}>
          <div className="sh ruled">
            <h2 className="disp">{section.title ?? "Trending now"}</h2>
            <span className="label-mono" style={{ color: "var(--muted)" }}>
              Last 24 hours
            </span>
          </div>
          <ol className="two-col" style={{ columnGap: 48 }}>
            {section.items.map((t, i) => (
              <li key={t.id} style={{ borderBottom: "1px solid var(--line)" }}>
                <Link href={contentPath(t)} className="card" style={{ display: "grid", gridTemplateColumns: "clamp(64px, 6.4cqw, 92px) minmax(0,1fr)", gap: 14, alignItems: "start", padding: "22px 0" }}>
                  <span aria-hidden style={{ ...D, lineHeight: 0.85, fontSize: "calc(clamp(52px, 5cqw, 72px) * var(--dsz))", color: "transparent", WebkitTextStroke: "1.25px var(--ink)" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
                    <span className={`chip ${t.type === "video" ? "chip-ink" : ""}`} style={t.type === "video" ? undefined : { border: 0, padding: "3px 0" }}>
                      {t.type === "video" ? "▶ Video" : "Article"}
                    </span>
                    <span className="disp card-title" style={{ lineHeight: 1.08, fontSize: "calc(clamp(22px, 1.9cqw, 27px) * var(--dsz))" }}>
                      {t.title}
                    </span>
                    <span className="meta">{trendingMeta(t)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
        {ctx.ads.slots.includes("sidebar") && (
          <aside style={{ flex: "0 0 300px", marginInline: "auto" }}>
            <AdSlot slot="sidebar" ctx={ctx} align="left" />
          </aside>
        )}
      </div>
    </section>
  );
}

function Videos({ section, ctx }: Props<"featured_videos">) {
  const [lead, ...rest] = section.items;
  return (
    <section className="wrap band-dark" style={{ paddingBlock: "clamp(40px, 4.5cqw, 80px)" }}>
      <SectionHead title={section.title ?? "Screening room"} link={{ href: "/videos", label: "All videos →" }} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: "clamp(20px, 3.3cqw, 48px)", alignItems: "center" }}>
        <Link href={contentPath(lead)} aria-label={`Watch ${lead.title}`} style={{ flex: "2 1 560px" }}>
          <Media image={lead.heroImage} ratio="16/9" sizes="(min-width: 1024px) 60vw, 100vw" label="top-left">
            <span className="play lg" />
            {lead.video?.durationSeconds ? (
              <span className="dur" style={{ right: 12, bottom: 12, fontSize: 12, padding: "4px 8px" }}>
                {formatDuration(lead.video.durationSeconds)}
              </span>
            ) : null}
          </Media>
        </Link>
        <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: 16 }}>
          <span className="label-mono" style={{ color: "var(--muted)" }}>
            Featured video{lead.video?.studio ? ` · ${lead.video.studio}` : ""}
          </span>
          <h3 className="disp" style={{ lineHeight: 1, fontSize: "calc(clamp(38px, 3.8cqw, 56px) * var(--dsz))" }}>
            {lead.title}
          </h3>
          {lead.review && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, ["--star-empty" as string]: "#3a3f47" }} role="img" aria-label={`Rated ${lead.review.score.toFixed(1)} out of 5`}>
              <Stars value={lead.review.score} size={18} />
              <span style={{ fontFamily: "var(--fm)", fontSize: 13 }}>{lead.review.score.toFixed(1)} / 5</span>
            </div>
          )}
          {lead.standfirst && <p style={{ fontSize: 17, lineHeight: 1.55, color: "#c9ced6" }}>{lead.standfirst}</p>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
            <Link href={contentPath(lead)} className="btn btn-primary btn-lg" style={{ height: 48 }}>
              Watch now
            </Link>
          </div>
        </div>
      </div>
      {ctx.ads.slots.includes("between_grid") && (
        <div style={{ padding: "clamp(32px, 3.6cqw, 52px) 0" }}>
          <AdSlot slot="between_grid" ctx={ctx} />
        </div>
      )}
      {rest.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(max(150px, calc((100% - 2 * 28px) / 3)), 1fr))", gap: "clamp(24px, 2.8cqw, 40px) clamp(12px, 2cqw, 28px)", marginTop: ctx.ads.slots.includes("between_grid") ? 0 : "clamp(32px, 3.6cqw, 52px)" }}>
          {rest.slice(0, 6).map((v) => (
            <Link key={v.id} href={contentPath(v)} className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Media image={v.heroImage} ratio="16/9" sizes="(min-width: 1024px) 30vw, 50vw" label="top-left" labelPrefix="">
                {v.video?.durationSeconds ? <span className="dur">▶ {formatDuration(v.video.durationSeconds)}</span> : null}
              </Media>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: "4px 12px" }}>
                <h3 className="disp card-title" style={{ lineHeight: 1.1, fontSize: "calc(clamp(18px, 1.7cqw, 24px) * var(--dsz))" }}>
                  {v.title}
                </h3>
                {v.review && (
                  <span style={{ fontFamily: "var(--fm)", fontSize: 12 }} aria-label={`Rated ${v.review.score.toFixed(1)} out of 5`}>
                    ★ {v.review.score.toFixed(1)}
                  </span>
                )}
              </div>
              <span className="meta" style={{ letterSpacing: "0.08em" }}>
                {v.video?.studio ?? ""}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function Picks({ section }: Props<"editors_picks">) {
  return (
    <section className="wrap" style={{ paddingBlock: "clamp(40px, 4.5cqw, 80px)" }}>
      <div className="sh">
        <h2 className="disp">{section.title ?? "The Edit"}</h2>
        <span className="label-mono" style={{ color: "var(--muted)" }}>
          Editor&apos;s picks
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(max(280px, calc((100% - 2 * 40px) / 3)), 1fr))", gap: "48px 40px", alignItems: "start" }}>
        {section.items.map((p, i) => (
          <Link key={p.id} href={contentPath(p)} className="card" style={{ display: "flex", flexDirection: "column", gap: 14, borderTop: "2px solid var(--ink)", paddingTop: 14 }}>
            <span className="label-mono">
              No. {i + 1} — <span className="kicker">{kickerOf(p)}</span>
            </span>
            <Media image={p.heroImage} ratio="3/4" sizes="(min-width: 1024px) 30vw, 100vw" />
            <h3 className="disp card-title" style={{ lineHeight: 1.02, fontSize: "calc(clamp(28px, 2.5cqw, 36px) * var(--dsz))" }}>
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
      <div className="sh ruled" style={{ alignItems: "baseline" }}>
        <h2 style={{ fontFamily: "var(--fm)", fontWeight: 500, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase" }}>
          Index — {section.title ?? "Popular categories"}
        </h2>
      </div>
      {section.categories.map((k) => (
        <Link key={k.id} href={`/category/${k.slug}`} className="card" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto clamp(64px, 9cqw, 132px)", gap: "clamp(14px, 2.2cqw, 32px)", alignItems: "center", padding: "clamp(10px, 1.2cqw, 16px) 0", borderBottom: "1px solid var(--line)" }}>
          <span className="disp card-title" style={{ lineHeight: 1, fontSize: "calc(clamp(38px, 5.6cqw, 84px) * var(--dsz))" }}>
            {k.name}
          </span>
          <span className="meta" style={{ textAlign: "right" }}>
            {countLabel(k.count)}
          </span>
          <Media image={k.image} ratio="3/2" sizes="132px" label="none" />
        </Link>
      ))}
    </section>
  );
}

function News({ section, ctx }: Props<"latest_news">) {
  return (
    <section className="wrap sec">
      <div style={{ display: "flex", flexWrap: "wrap", gap: "clamp(28px, 3.3cqw, 56px)", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 600px" }}>
          <div className="sh ruled">
            <h2 className="disp">{section.title ?? "The Wire"}</h2>
            <Link href="/news" className="sh-link" style={{ borderBottom: 0, padding: 0 }}>
              Latest news →
            </Link>
          </div>
          <div className="two-col" style={{ columnGap: 40 }}>
            {section.items.map((n: ContentCard) => (
              <Link key={n.id} href={contentPath(n)} className="card" style={{ display: "flex", flexDirection: "column", gap: 4, padding: "16px 0", borderBottom: "1px solid var(--line)" }}>
                <span className="row-kicker label-mono" style={{ fontSize: 10 }}>
                  <time dateTime={n.publishedAt.toISOString()} className="kicker" style={{ fontSize: 10 }}>
                    {formatNewsTime(n.publishedAt, tzOf(ctx))}
                  </time>
                  <span style={{ color: "var(--muted)" }}>{kickerOf(n)}</span>
                </span>
                <span className="card-title" style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.35 }}>
                  {n.title}
                </span>
              </Link>
            ))}
          </div>
        </div>
        {ctx.ads.slots.includes("in_content") && (
          <aside style={{ flex: "0 0 300px", marginInline: "auto" }}>
            <AdSlot slot="in_content" ctx={ctx} align="left" />
          </aside>
        )}
      </div>
    </section>
  );
}

export function IssueSection({ section, ctx, first }: { section: ResolvedSection; ctx: SiteContext; first: boolean }) {
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
