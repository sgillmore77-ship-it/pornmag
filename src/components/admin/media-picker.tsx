"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { listMediaAction, uploadMediaAction } from "@/app/[site]/admin/actions";
import { mediaUrl } from "@/lib/media";

export type PickedMedia = { id: string; storageKey: string; alt: string; caption?: string | null; width: number | null; height: number | null; blurColor?: string | null };

/** Thumbnail that also handles seeded placeholder media. */
export function MediaThumb({ m, ratio = "4/3" }: { m: Pick<PickedMedia, "storageKey" | "alt" | "blurColor">; ratio?: string }) {
  if (m.storageKey.startsWith("placeholder:")) {
    return <div className="media is-ph" style={{ aspectRatio: ratio, backgroundColor: m.blurColor ?? m.storageKey.slice(12) }} aria-label={m.alt} role="img" />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={mediaUrl(m.storageKey)} alt={m.alt} style={{ aspectRatio: ratio, objectFit: "cover", width: "100%", display: "block", background: "var(--raised)" }} loading="lazy" />;
}

function imageSize(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

/** Uploads one image; returns the new media item. */
export async function uploadImage(file: File, alt = ""): Promise<{ ok: true; media: PickedMedia } | { ok: false; error: string }> {
  const size = await imageSize(file);
  const form = new FormData();
  form.set("file", file);
  form.set("alt", alt);
  if (size) {
    form.set("width", String(size.width));
    form.set("height", String(size.height));
  }
  const r = await uploadMediaAction(form);
  return r.ok ? { ok: true, media: r.data! } : { ok: false, error: r.error };
}

export function UploadButton({ onUploaded, label = "Upload image" }: { onUploaded: (m: PickedMedia) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 6 }}>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          setError(null);
          const r = await uploadImage(file);
          setBusy(false);
          if (r.ok) onUploaded(r.media);
          else setError(r.error);
        }}
      />
      <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? "Uploading…" : label}
      </button>
      {error && <span className="notice notice-err">{error}</span>}
    </span>
  );
}

/** Modal library: search, pick, or upload. */
export function MediaPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (m: PickedMedia) => void }) {
  const [items, setItems] = useState<PickedMedia[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const load = useCallback(
    (query: string) =>
      start(async () => {
        const r = await listMediaAction(query);
        if (r.ok) setItems(r.data ?? []);
        else setError(r.error);
      }),
    [],
  );

  useEffect(() => {
    if (open) load("");
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Choose an image" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h2>Choose an image</h2>
          <div className="toolbar">
            <UploadButton
              onUploaded={(m) => {
                onPick(m);
                onClose();
              }}
            />
            <button type="button" className="btn btn-sm" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </div>
        <div className="panel-pad">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              load(q);
            }}
            className="toolbar"
            style={{ marginBottom: 16 }}
          >
            <input className="inp" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search alt text and captions" style={{ maxWidth: 360 }} />
            <button className="btn btn-outline btn-sm">Search</button>
          </form>
          {error && <p className="notice notice-err">{error}</p>}
          {pending && items.length === 0 ? (
            <p className="dek">Loading…</p>
          ) : items.length === 0 ? (
            <p className="dek">No images yet. Upload one.</p>
          ) : (
            <div className="media-grid">
              {items.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="media-tile"
                  onClick={() => {
                    onPick(m);
                    onClose();
                  }}
                >
                  <MediaThumb m={m} />
                  <span className="cap">{m.alt || m.caption || "No alt text"}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
