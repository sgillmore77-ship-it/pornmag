"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { approveVideoHostAction, importVideosAction, previewFeedAction } from "@/app/[site]/admin/actions";
import type { FeedPreview, ImportResult } from "@/data/admin/video-import";

const fmt = (s: number | null) => (s == null ? "—" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);

export function VideoImporter({ canApprove }: { canApprove: boolean }) {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<FeedPreview | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [cats, setCats] = useState(true);
  const [tags, setTags] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState("");

  const load = () =>
    start(async () => {
      setError(null);
      setResult(null);
      setPicked([]);
      const r = await previewFeedAction(url, 200);
      if (r.ok) setPreview(r.data ?? null);
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
            <button className="btn btn-primary" disabled={pending || !url.trim()} onClick={load}>
              {pending && !preview ? "Loading…" : "Load videos"}
            </button>
          </div>
          {error && <p className="notice notice-err" role="alert">{error}</p>}
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
              {preview.videos.length} videos in the feed{preview.skippedRows ? ` (${preview.skippedRows} unreadable rows skipped)` : ""}
            </h2>
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
                            const p = await previewFeedAction(url, 200);
                            if (p.ok) setPreview(p.data ?? null);
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
                    const chosen = preview.videos.filter((v) => picked.includes(v.sourceId));
                    const r = await importVideosAction(chosen, { categoriesAsTags: cats, tagsAsTags: tags });
                    if (!r.ok) return setError(r.error);
                    setResult(r.data ?? null);
                    setPicked([]);
                    const p = await previewFeedAction(url, 200);
                    if (p.ok) setPreview(p.data ?? null);
                  })
                }
              >
                {pending && picked.length ? "Importing…" : "Import as drafts"}
              </button>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{ width: 32 }}>
                      <input
                        type="checkbox"
                        aria-label="Select the first 25 shown"
                        checked={selectable.length > 0 && selectable.slice(0, 25).every((v) => picked.includes(v.sourceId))}
                        onChange={(e) => setPicked(e.target.checked ? selectable.slice(0, 25).map((v) => v.sourceId) : [])}
                      />
                    </th>
                    <th>Title</th>
                    <th>Length</th>
                    <th>Categories</th>
                    <th>Thumbnail</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((v) => (
                    <tr key={v.sourceId} style={{ opacity: v.approved && !v.imported ? 1 : 0.55 }}>
                      <td>
                        <input type="checkbox" aria-label={`Select ${v.title}`} disabled={!v.approved || v.imported} checked={picked.includes(v.sourceId)} onChange={() => toggle(v.sourceId)} />
                      </td>
                      <td>
                        {v.title}
                        {v.imported && <span className="status status-published" style={{ marginLeft: 8 }}>imported</span>}
                        {v.models.length > 0 && <div className="sub">{v.models.join(", ")}</div>}
                      </td>
                      <td>{fmt(v.durationSeconds)}</td>
                      <td style={{ fontSize: 13, color: "var(--muted)" }}>{v.categories.slice(0, 4).join(", ")}</td>
                      <td style={{ fontSize: 13, color: "var(--muted)" }}>{v.thumbUrl ? "yes" : "none"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
