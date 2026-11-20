"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { approveVideoHostAction, forgetRecentFeedAction, importVideosAction, previewFeedAction, previewFeedFileAction } from "@/app/[site]/admin/actions";
import type { FeedPreview, ImportResult } from "@/data/admin/video-import";
import { feedLabel } from "@/lib/feed-label";
import { ScreenshotPicker, sharpest } from "./screenshot-picker";

const fmt = (s: number | null) => (s == null ? "—" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);

type RecentFeed = { url: string; label: string; usedAt: string };

export function VideoImporter({ canApprove, recentFeeds = [] }: { canApprove: boolean; recentFeeds?: RecentFeed[] }) {
  const [url, setUrl] = useState(recentFeeds[0]?.url ?? "");
  const [recent, setRecent] = useState(recentFeeds);
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<FeedPreview | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [cats, setCats] = useState(true);
  const [tags, setTags] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState("");
  const [watching, setWatching] = useState<FeedPreview["videos"][number] | null>(null);
  const [playing, setPlaying] = useState(false);
  /** Picture chosen per video (sourceId → screenshot address). */
  const [pictures, setPictures] = useState<Record<string, string>>({});
  const [limit, setLimit] = useState(200);
  const [fromFile, setFromFile] = useState(false);
  const [importNote, setImportNote] = useState<string | null>(null);

  useEffect(() => {
    if (!watching) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- each video opens on its screenshots, not the player
    setPlaying(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setWatching(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [watching]);

  const load = (feedUrl = url, max = limit) =>
    start(async () => {
      setError(null);
      setResult(null);
      setPicked([]);
      setFromFile(false);
      const r = await previewFeedAction(feedUrl, max);
      setBusy(!r.ok && /limiting|answered 4|answered 5|Couldn't download/i.test(r.error));
      if (r.ok) {
        setPreview(r.data ?? null);
        setRecent((list) => {
          let entry: RecentFeed;
          try {
            const u = new URL(feedUrl.trim()).toString();
            entry = list.find((f) => f.url === u) ?? { url: u, label: feedLabel(u), usedAt: new Date().toISOString() };
          } catch {
            return list;
          }
          return [entry, ...list.filter((f) => f.url !== entry.url)].slice(0, 8);
        });
      }
      else {
        setPreview(null);
        setError(r.error);
      }
    });

  const shown = (preview?.videos ?? []).filter((v) => !filter || `${v.title} ${v.categories.join(" ")} ${v.models.join(" ")}`.toLowerCase().includes(filter.toLowerCase()));
  const selectable = shown.filter((v) => v.approved && !v.imported);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 25 ? p : [...p, id]));

  return (
    <div className="form-grid">
      {watching && (
        <div className="vimp-modal" role="dialog" aria-modal="true" aria-label={`Preview: ${watching.title}`} onClick={() => setWatching(null)}>
          <div className="vimp-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="vimp-modal-head">
              <strong>{watching.title}</strong>
              <button type="button" className="btn btn-sm" onClick={() => setWatching(null)} autoFocus>
                Close
              </button>
            </div>
            <ScreenshotPicker
              key={watching.sourceId}
              thumbUrl={watching.thumbUrl}
              chosen={pictures[watching.sourceId] ?? null}
              onChoose={(u) => setPictures((m) => ({ ...m, [watching.sourceId]: u }))}
            />
            {!playing ? (
              <p className="hint" style={{ margin: 0 }}>
                Judge it from the screenshots where you can: plays here count as views on your partner account.{" "}
                <button type="button" className="btn btn-sm" onClick={() => setPlaying(true)}>▶ Play video</button>
              </p>
            ) : (
            <div className="vimp-frame">
              <iframe
                src={watching.embedUrl}
                title={watching.title}
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
                sandbox="allow-scripts allow-same-origin allow-presentation"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
            )}
            <div className="toolbar" style={{ justifyContent: "space-between" }}>
              <span className="sub">
                {fmt(watching.durationSeconds)} · {watching.categories.join(", ")}
              </span>
              {watching.approved && !watching.imported && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    toggle(watching.sourceId);
                    setWatching(null);
                  }}
                >
                  {picked.includes(watching.sourceId) ? "Unselect" : "Select this video"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <section className="panel">
        <div className="panel-pad form-grid">
          <label className="f">
            <span>Feed link</span>
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://txxx.com/admin/feeds/promo/?promo=…" spellCheck={false} />
            <span className="hint">
              In TubeCorporate: Gallery → Feeds, choose a site and categories, tick &quot;Use embed code&quot;, and add these CSV fields: Embed code, ID, Title, Duration, Main thumbnail, Thumbnail prefix, Categories, Tags. Then &quot;Copy URL to Clipboard&quot; and paste it here.
            </span>
          </label>
          <div className="toolbar">
            <button className="btn btn-primary" disabled={pending || !url.trim()} onClick={() => load()}>
              {pending && !preview ? "Loading…" : "Load videos"}
            </button>
          </div>
          {recent.length > 0 && (
            <div className="f">
              <span>Your recent feeds <span className="hint">Click one to load it</span></span>
              <div className="toolbar" style={{ flexWrap: "wrap", gap: 8 }}>
                {recent.map((f) => (
                  <span key={f.url} className="vimp-recent">
                    <button
                      type="button"
                      className={`btn btn-sm ${f.url === url ? "btn-primary" : "btn-outline"}`}
                      disabled={pending}
                      title={f.url}
                      onClick={() => {
                        setUrl(f.url);
                        load(f.url);
                      }}
                    >
                      {f.label}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      aria-label={`Forget ${f.label}`}
                      title="Remove from this list"
                      disabled={pending}
                      onClick={() => {
                        setRecent((list) => list.filter((x) => x.url !== f.url));
                        void forgetRecentFeedAction(f.url);
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
          {error && <p className="notice notice-err" role="alert">{error}</p>}
          <div className={busy ? "notice" : undefined} style={busy ? undefined : { borderTop: "1px solid var(--line)", paddingTop: 14 }}>
            <p style={{ margin: 0, fontWeight: 600 }}>{busy ? "Load it through your own browser instead:" : "Partner refusing downloads? Use your own browser:"}</p>
            <ol style={{ margin: "8px 0 12px", paddingLeft: 20, listStyle: "decimal", lineHeight: 1.6, fontSize: 14 }}>
              <li>
                {url.trim() && /^https:\/\//.test(url.trim()) ? (
                  <a href={url.trim()} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>Open the feed link ↗</a>
                ) : (
                  "Open your feed link"
                )}{" "}
                in a new tab. Your browser downloads the file, or shows lines of text (then press Ctrl+S / ⌘S to save it).
              </li>
              <li>Upload that file here:</li>
            </ol>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                start(async () => {
                  setError(null);
                  setResult(null);
                  setPicked([]);
                  if (f.size > 900_000) {
                    setPreview(null);
                    return setError("That file is too large. In TubeCorporate, set the feed limit to 500 videos or fewer.");
                  }
                  const r = await previewFeedFileAction(await f.text(), 500);
                  setFromFile(true);
                  if (r.ok) {
                    setPreview(r.data ?? null);
                    setBusy(false);
                  } else {
                    setPreview(null);
                    setError(r.error);
                  }
                });
              }}
            />
            <button type="button" className="btn btn-outline btn-sm" disabled={pending} onClick={() => fileInput.current?.click()}>
              Upload feed file
            </button>
          </div>
        </div>
      </section>

      {result && (
        <section className="panel">
          <div className="panel-pad">
            <p className="notice notice-ok" role="status">
              Imported {result.imported.length} {result.imported.length === 1 ? "video" : "videos"} as drafts.{" "}
              <Link href="/admin/content?type=video&status=draft" style={{ textDecoration: "underline" }}>
                Review drafts
              </Link>
            </p>
            {result.skipped.length > 0 && (
              <ul style={{ marginTop: 10, fontSize: 13, color: "var(--muted)" }}>
                {result.skipped.map((s, i) => (
                  <li key={i}>
                    Skipped “{s.title}”: {s.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {preview && (
        <section className="panel">
          <div className="panel-head">
            <h2>
              {preview.totalInFeed > preview.videos.length
                ? `Showing ${preview.videos.length} of ${preview.totalInFeed.toLocaleString("en-GB")} videos in the feed`
                : `${preview.videos.length} videos in the feed`}
              {preview.skippedRows ? ` (${preview.skippedRows} unreadable rows skipped)` : ""}
            </h2>
            {!fromFile && (
            <label className="check" style={{ gap: 6 }}>
              Show
              <select
                value={limit}
                disabled={pending}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setLimit(n);
                  if (url) load(url, n);
                }}
              >
                {[100, 200, 500].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            )}
          </div>
          <div className="panel-pad form-grid">
            {preview.unapprovedHosts.length > 0 && (
              <div className="notice notice-err">
                {preview.unapprovedHosts.map((h) => (
                  <div key={h} className="toolbar" style={{ justifyContent: "space-between" }}>
                    <span>
                      Videos from <strong>{h}</strong> can&apos;t be added until it&apos;s an approved video player.
                    </span>
                    {canApprove && (
                      <button
                        className="btn btn-sm"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            const r = await approveVideoHostAction(h);
                            if (!r.ok) return setError(r.error);
                            setPreview((p) =>
                              p && {
                                ...p,
                                unapprovedHosts: p.unapprovedHosts.filter((x) => x !== h),
                                videos: p.videos.map((v) => (v.embedHost === h ? { ...v, approved: true } : v)),
                              },
                            );
                          })
                        }
                      >
                        Approve {h}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="toolbar">
              <input className="inp" type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by title, category or performer" style={{ maxWidth: 320 }} aria-label="Filter videos" />
              <label className="check"><input type="checkbox" checked={cats} onChange={(e) => setCats(e.target.checked)} />Add categories as tags</label>
              <label className="check"><input type="checkbox" checked={tags} onChange={(e) => setTags(e.target.checked)} />Add the feed&apos;s tags</label>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 13, color: "var(--muted)" }}>{picked.length} of 25 selected</span>
              <button
                className="btn btn-primary"
                disabled={pending || picked.length === 0}
                onClick={() =>
                  start(async () => {
                    setImportNote("Finding the sharpest pictures…");
                    // Use the picture chosen for each video, otherwise the sharpest copy of the feed's main screenshot.
                    const chosen = await Promise.all(
                      preview.videos
                        .filter((v) => picked.includes(v.sourceId))
                        .map(async (v) => ({ ...v, thumbUrl: pictures[v.sourceId] ?? (v.thumbUrl ? ((await sharpest(v.thumbUrl))?.url ?? v.thumbUrl) : null) })),
                    );
                    setImportNote(null);
                    const r = await importVideosAction(chosen, { categoriesAsTags: cats, tagsAsTags: tags });
                    if (!r.ok) return setError(r.error);
                    setResult(r.data ?? null);
                    setPicked([]);
                    const p = await previewFeedAction(url, limit);
                    if (p.ok) setPreview(p.data ?? null);
                  })
                }
              >
                {importNote ?? (pending && picked.length ? "Importing…" : "Import as drafts")}
              </button>
            </div>
            <div className="toolbar">
              <label className="check">
                <input
                  type="checkbox"
                  checked={selectable.length > 0 && selectable.slice(0, 25).every((v) => picked.includes(v.sourceId))}
                  onChange={(e) => setPicked(e.target.checked ? selectable.slice(0, 25).map((v) => v.sourceId) : [])}
                />
                Select the first 25 shown
              </label>
            </div>
            <ul className="vimp-grid">
              {shown.map((v) => {
                const disabled = !v.approved || v.imported;
                const on = picked.includes(v.sourceId);
                return (
                  <li key={v.sourceId} className={`vimp-card${on ? " is-on" : ""}${disabled ? " is-off" : ""}`}>
                    <button type="button" className="vimp-thumb" onClick={() => setWatching(v)} aria-label={`Preview ${v.title}`}>
                      {v.thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- admin-only preview straight from the partner; imports copy it to our storage
                        <img src={pictures[v.sourceId] ?? v.thumbUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="vimp-none">No thumbnail</span>
                      )}
                      <span className="vimp-play" aria-hidden>Screenshots</span>
                      {pictures[v.sourceId] && <span className="vimp-chosen">Picture chosen</span>}
                      <span className="vimp-dur">{fmt(v.durationSeconds)}</span>
                    </button>
                    <label className="vimp-meta">
                      <input type="checkbox" disabled={disabled} checked={on} onChange={() => toggle(v.sourceId)} aria-label={`Select ${v.title}`} />
                      <span>
                        <strong>{v.title}</strong>
                        {v.imported && <span className="status status-published" style={{ marginLeft: 6 }}>imported</span>}
                        <span className="sub">{[v.models.join(", "), v.categories.slice(0, 3).join(", ")].filter(Boolean).join(" · ")}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
