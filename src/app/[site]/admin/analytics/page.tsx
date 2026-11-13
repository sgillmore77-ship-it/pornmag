import Link from "next/link";
import { PageHead } from "@/components/admin/bits";
import { analyticsReport, type Source } from "@/data/analytics";
import { requireAdminPage } from "@/lib/admin";
import { isoDay } from "@/lib/format";
import { can } from "@/lib/permissions";

const RANGES = [7, 30, 90] as const;
const SOURCE_LABEL: Record<Source, string> = { direct: "Direct / unknown", internal: "Clicks within the site", search: "Search engines", social: "Social & messaging", referral: "Other websites" };
const n = (v: number) => v.toLocaleString("en-GB");

function DailyChart({ days }: { days: { day: string; views: number }[] }) {
  const W = 760;
  const H = 180;
  const pad = { l: 40, r: 8, t: 10, b: 22 };
  const max = Math.max(1, ...days.map((d) => d.views));
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step;
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const slot = iw / days.length;
  const bw = Math.max(2, Math.min(18, slot - 2));
  const y = (v: number) => pad.t + ih - (v / top) * ih;
  const label = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const every = Math.ceil(days.length / 7);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Page views per day" className="an-chart">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={pad.l} x2={W - pad.r} y1={y(top * f)} y2={y(top * f)} className="an-grid" />
          <text x={pad.l - 6} y={y(top * f) + 4} textAnchor="end" className="an-tick">{n(Math.round(top * f))}</text>
        </g>
      ))}
      {days.map((d, i) => {
        const x = pad.l + i * slot + (slot - bw) / 2;
        const h = Math.max(d.views ? 2 : 0, pad.t + ih - y(d.views));
        return (
          <g key={d.day} className="an-bar">
            {/* Generous hit area for the tooltip. */}
            <rect x={pad.l + i * slot} y={pad.t} width={slot} height={ih} fill="transparent" />
            <path d={h ? `M${x},${pad.t + ih} v${-(h - Math.min(2, h))} q0,-2 2,-2 h${bw - 4} q2,0 2,2 v${h - Math.min(2, h)} z` : ""} className="an-fill" />
            <title>{`${label(d.day)}: ${n(d.views)} views`}</title>
            {i % every === 0 && <text x={pad.l + i * slot + slot / 2} y={H - 6} textAnchor="middle" className="an-tick">{label(d.day)}</text>}
          </g>
        );
      })}
      <line x1={pad.l} x2={W - pad.r} y1={pad.t + ih} y2={pad.t + ih} className="an-axis" />
    </svg>
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const a = await requireAdminPage("analytics.view");
  const wanted = (await searchParams).range;
  const range = RANGES.find((r) => String(r) === wanted) ?? 30;
  const tz = a.ctx.publication.settings.timeZone ?? "Europe/London";
  const r = await analyticsReport(a.db, a.ctx.site, isoDay(new Date(), tz), range);
  const change = r.previousTotal ? Math.round(((r.total - r.previousTotal) / r.previousTotal) * 100) : null;
  const sourceMax = Math.max(1, ...r.sources.map((s) => s.views));
  const showAds = can(a.actor, "publication.manage");

  return (
    <>
      <PageHead title="Analytics" sub="Counted on this site without cookies or tracking: one view per page per visit. Bots aren't counted, and neither are you and your team: any device where admin has been opened is left out (from 13 Nov 2026). Days follow the site's time zone." />
      <div className="tabs">
        {RANGES.map((d) => (
          <Link key={d} href={`/admin/analytics?range=${d}`} aria-current={range === d ? "page" : undefined}>Last {d} days</Link>
        ))}
      </div>
      <div className="stats" style={{ marginBottom: 20 }}>
        <div className="stat"><div className="n">{n(r.total)}</div><div className="l">page views{change !== null && <> · {change >= 0 ? "▲" : "▼"} {Math.abs(change)}% vs previous {range} days</>}</div></div>
        <div className="stat"><div className="n">{n(r.storyViews)}</div><div className="l">story views</div></div>
        <div className="stat"><div className="n">{n(Math.round(r.total / range))}</div><div className="l">views a day on average</div></div>
      </div>

      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head"><h2>Page views per day</h2></div>
        <div className="panel-pad">
          {r.total === 0 ? <p style={{ color: "var(--muted)" }}>No views counted yet. Numbers appear as readers visit.</p> : <DailyChart days={r.days} />}
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--muted)" }}>Show as a table</summary>
            <table className="tbl" style={{ marginTop: 8 }}>
              <thead><tr><th>Day</th><th style={{ textAlign: "right" }}>Page views</th><th style={{ textAlign: "right" }}>Story views</th></tr></thead>
              <tbody>{[...r.days].reverse().map((d) => <tr key={d.day}><td>{d.day}</td><td style={{ textAlign: "right" }}>{n(d.views)}</td><td style={{ textAlign: "right" }}>{n(d.storyViews)}</td></tr>)}</tbody>
            </table>
          </details>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20, alignItems: "start" }}>
        <section className="panel">
          <div className="panel-head"><h2>Most read</h2></div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Story</th><th style={{ textAlign: "right" }}>Views</th><th style={{ textAlign: "right" }}>Comments</th></tr></thead>
              <tbody>
                {r.top.map((t) => (
                  <tr key={t.id}>
                    <td><Link href={`/admin/content/${t.id}`} className="t">{t.title}</Link> <Link href={t.path} target="_blank" className="label-mono" style={{ fontSize: 10 }}>↗</Link></td>
                    <td style={{ textAlign: "right" }}>{n(t.views)}</td>
                    <td style={{ textAlign: "right" }}>{n(t.comments)}</td>
                  </tr>
                ))}
                {r.top.length === 0 && <tr><td colSpan={3} style={{ color: "var(--muted)" }}>Nothing yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Where readers came from</h2></div>
          <div className="panel-pad">
            {r.sources.length === 0 ? (
              <p style={{ color: "var(--muted)" }}>Nothing yet.</p>
            ) : (
              <ul className="an-sources">
                {r.sources.map((s) => (
                  <li key={s.source}>
                    <div className="an-src-row"><span>{SOURCE_LABEL[s.source] ?? s.source}</span><span>{n(s.views)} · {Math.round((s.views / r.total) * 100)}%</span></div>
                    <div className="an-track"><div className="an-meter" style={{ width: `${(s.views / sourceMax) * 100}%` }} /></div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {showAds && (
        <section className="panel" style={{ marginTop: 20 }}>
          <div className="panel-head"><h2>Ads</h2><Link href="/admin/ads" className="btn btn-sm">Manage ads</Link></div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Placement</th><th>Advertiser</th><th style={{ textAlign: "right" }}>Impressions</th><th style={{ textAlign: "right" }}>Clicks</th><th style={{ textAlign: "right" }}>Click rate</th></tr></thead>
              <tbody>
                {r.ads.map((ad) => (
                  <tr key={ad.id}>
                    <td>{ad.name}</td>
                    <td>{ad.advertiser ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>{n(ad.impressions)}</td>
                    <td style={{ textAlign: "right" }}>{n(ad.clicks)}</td>
                    <td style={{ textAlign: "right" }}>{ad.impressions ? `${((ad.clicks / ad.impressions) * 100).toFixed(2)}%` : "—"}</td>
                  </tr>
                ))}
                {r.ads.length === 0 && <tr><td colSpan={5} style={{ color: "var(--muted)" }}>No placements.</td></tr>}
              </tbody>
            </table>
            <p style={{ padding: "10px 20px", fontSize: 12, color: "var(--muted)" }}>Clicks are only counted for banners sold directly; ad networks report their own clicks and earnings.</p>
          </div>
        </section>
      )}
    </>
  );
}
