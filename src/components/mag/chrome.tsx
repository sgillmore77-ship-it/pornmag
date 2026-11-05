import Link from "next/link";
import type { NavLink } from "@/db/schema";
import { formatLongDateline } from "@/lib/format";
import type { SiteContext } from "@/lib/site-context";
import { layoutOf } from "@/lib/theme";
import { AdSlot } from "./ad-slot";
import { MobileMenu, NavRail } from "./nav-links";
import { Wordmark } from "./wordmark";


const SearchIcon = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
    <circle cx="7.5" cy="7.5" r="5.5" />
    <line x1="11.6" y1="11.6" x2="16.5" y2="16.5" />
  </svg>
);

function navFor(ctx: SiteContext): NavLink[] {
  return ctx.publication.settings.nav ?? [
    { label: "Features", href: "/features" },
    { label: "Reviews", href: "/reviews" },
    { label: "Videos", href: "/videos" },
    { label: "News", href: "/news" },
  ];
}

/** Links for the mobile menu: main nav plus account. */
function menuFor(ctx: SiteContext): NavLink[] {
  const extra = [
    { label: "Search", href: "/search" },
    { label: "Reviews", href: "/reviews" },
    { label: "Features", href: "/features" },
    { label: "News", href: "/news" },
    { label: "Your account", href: "/account" },
  ];
  const nav = navFor(ctx);
  return [...nav, ...extra.filter((e) => !nav.some((n) => n.href === e.href))];
}

function HeaderAd({ ctx }: { ctx: SiteContext }) {
  if (!ctx.ads.slots.includes("header_leaderboard")) return null;
  return (
    <div className="ad-top">
      <AdSlot slot="header_leaderboard" ctx={ctx} hideLabel />
    </div>
  );
}

/** 1a "The Feed": logo left, utilities right, category rail below. */
function FeedHeader({ ctx }: { ctx: SiteContext }) {
  return (
    <header className="hdr-feed">
      <HeaderAd ctx={ctx} />
      <div style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="bar">
          <Link href="/" aria-label={`${ctx.publication.name} home`}>
            <Wordmark name={ctx.publication.name} />
          </Link>
          <div className="utils only-d">
            <Link href="/search" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <SearchIcon />
              Search
            </Link>
            <Link href="/account">Account</Link>
          </div>
          <div className="only-m" style={{ alignItems: "center" }}>
            <Link href="/search" className="icon-btn" aria-label="Search">
              <SearchIcon size={20} />
            </Link>
            <MobileMenu items={menuFor(ctx)} />
          </div>
        </div>
        <NavRail items={navFor(ctx)} />
      </div>
    </header>
  );
}

/** 1b "The Issue": dateline, giant centred masthead, category rail between rules. */
function IssueHeader({ ctx }: { ctx: SiteContext }) {
  const tz = ctx.publication.settings.timeZone;
  return (
    <header className="hdr-issue">
      <HeaderAd ctx={ctx} />
      <div className="wrap">
        <div className="dateline">
          <span className="only-d" style={{ color: "var(--muted)" }}>
            {formatLongDateline(new Date(), tz)}
          </span>
          <span className="only-m">
            <MobileMenu items={menuFor(ctx)} />
          </span>
          <span>{ctx.publication.settings.issueLabel ?? ctx.publication.tagline ?? ""}</span>
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 24 }}>
            <Link href="/account" className="only-d">
              Account
            </Link>
            <Link href="/search" className="icon-btn" aria-label="Search" style={{ justifyContent: "flex-end" }}>
              <SearchIcon size={18} />
            </Link>
          </div>
        </div>
        <Link href="/" className="masthead" aria-label={`${ctx.publication.name} home`}>
          {ctx.publication.name}
          <span className="dot" style={{ color: "var(--brand)" }}>
            .
          </span>
        </Link>
        <NavRail items={navFor(ctx)} />
      </div>
    </header>
  );
}

export function SiteHeader({ ctx }: { ctx: SiteContext }) {
  return layoutOf(ctx.publication.theme) === "feed" ? <FeedHeader ctx={ctx} /> : <IssueHeader ctx={ctx} />;
}

export function SiteFooter({ ctx }: { ctx: SiteContext }) {
  const { publication } = ctx;
  const issue = layoutOf(publication.theme) === "issue";
  const columns = publication.settings.footer ?? [];
  const year = new Date().getFullYear();

  const cols = columns.length > 0 && (
    <div className="ftr-cols">
      {columns.map((c) => (
        <div key={c.title}>
          <span className="meta" style={{ fontSize: 10, letterSpacing: "0.12em" }}>
            {c.title}
          </span>
          {c.links.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <footer className="ftr">
      {ctx.ads.slots.includes("footer") && (
        <div className="ftr-ad">
          <AdSlot slot="footer" ctx={ctx} />
        </div>
      )}
      <div className="wrap" style={{ paddingTop: "clamp(40px, 4.5cqw, 72px)", paddingBottom: 28, display: "flex", flexDirection: "column", gap: issue ? "clamp(32px, 4cqw, 56px)" : 40 }}>
        {issue ? (
          <>
            {cols}
            <span aria-hidden className="masthead" style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textAlign: "center", fontFamily: "var(--fd)", fontWeight: "var(--dw)" as unknown as number, textTransform: "var(--dt)" as "none", letterSpacing: "-0.03em", lineHeight: 0.9, fontSize: "calc(11.6cqw * var(--dsz))" }}>
              {publication.name}
              <span style={{ color: "var(--brand)" }}>.</span>
            </span>
          </>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 40, justifyContent: "space-between" }}>
            <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: 12, maxWidth: 380 }}>
              <Wordmark name={publication.name} style={{ fontSize: "calc(36px * var(--dsz))" }} />
              {publication.settings.footerBlurb && <p style={{ fontSize: 15, lineHeight: 1.55, color: "var(--muted)" }}>{publication.settings.footerBlurb}</p>}
            </div>
            <div style={{ flex: "2 1 480px" }}>{cols}</div>
          </div>
        )}
        <div className="ftr-base">
          <span>
            © {year} {publication.name}. All performers depicted were 18 or older at the time of production.
          </span>
          <span className="chip-18">18+</span>
        </div>
      </div>
    </footer>
  );
}
