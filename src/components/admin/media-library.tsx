"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateMediaAction } from "@/app/[site]/admin/actions";
import { MediaThumb, uploadImage, type PickedMedia } from "./media-picker";

type Item = PickedMedia & { credit: string | null; mimeType: string; sizeBytes: number | null; createdAt: string };

function kb(n: number | null) {
  if (!n) return "";
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
}

export function MediaLibrary({ items }: { items: Item[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Item | null>(null);
  const [form, setForm] = useState({ alt: "", caption: "", credit: "" });
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function pick(m: Item) {
    setSelected(m);
    setForm({ alt: m.alt, caption: m.caption ?? "", credit: m.credit ?? "" });
    setNotice(null);
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setNotice(null);
    const list = Array.from(files);
    for (const [i, f] of list.entries()) {
      setUploading(`Uploading ${i + 1} of ${list.length}…`);
      const r = await uploadImage(f);
      if (!r.ok) {
        setNotice({ ok: false, text: `${f.name}: ${r.error}` });
        break;
      }
    }
    setUploading(null);
    router.refresh();
  }

  return (
    <div className="editor-layout">
      <div style={{ minWidth: 0 }}>
        <label
          className="panel panel-pad"
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, borderStyle: "dashed", cursor: "pointer", marginBottom: 20, textAlign: "center" }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFiles(e.dataTransfer.files);
          }}
        >
          <input type="file" multiple hidden accept="image/jpeg,image/png,image/webp,image/avif,image/gif" onChange={(e) => onFiles(e.target.files)} />
          <strong>{uploading ?? "Drop images here, or click to upload"}</strong>
          <span className="hint" style={{ color: "var(--muted)", fontSize: 13 }}>
            JPEG, PNG, WebP, AVIF or GIF · up to 15 MB each
          </span>
        </label>
        {notice && <p className={`notice ${notice.ok ? "notice-ok" : "notice-err"}`} style={{ marginBottom: 16 }}>{notice.text}</p>}
        <div className="media-grid">
          {items.map((m) => (
            <button key={m.id} type="button" className="media-tile" aria-pressed={selected?.id === m.id} onClick={() => pick(m)}>
              <MediaThumb m={m} />
              <span className="cap" style={!m.alt ? { color: "#9b1c1c" } : undefined}>
                {m.alt || "Needs alt text"}
              </span>
            </button>
          ))}
        </div>
      </div>
      <aside className="editor-side">
        {selected ? (
          <section className="panel panel-pad form-grid">
            <MediaThumb m={selected} ratio="16/10" />
            <span className="hint" style={{ fontSize: 12, color: "var(--muted)" }}>
              {[selected.width && selected.height ? `${selected.width} × ${selected.height}` : null, kb(selected.sizeBytes), selected.mimeType.replace("image/", "").toUpperCase()]
                .filter(Boolean)
                .join(" · ")}
            </span>
            <label className="f">
              <span>
                Alt text <span className="hint">Describe the image for people who can&apos;t see it.</span>
              </span>
              <textarea value={form.alt} maxLength={300} onChange={(e) => setForm({ ...form, alt: e.target.value })} />
            </label>
            <label className="f">
              <span>Caption</span>
              <input type="text" value={form.caption} maxLength={500} onChange={(e) => setForm({ ...form, caption: e.target.value })} />
            </label>
            <label className="f">
              <span>Credit</span>
              <input type="text" value={form.credit} maxLength={200} placeholder="Photographer / agency" onChange={(e) => setForm({ ...form, credit: e.target.value })} />
            </label>
            {notice && <p className={`notice ${notice.ok ? "notice-ok" : "notice-err"}`}>{notice.text}</p>}
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await updateMediaAction({ id: selected.id, ...form });
                  setNotice(r.ok ? { ok: true, text: "Saved" } : { ok: false, text: r.error });
                  if (r.ok) router.refresh();
                })
              }
            >
              {pending ? "Saving…" : "Save details"}
            </button>
          </section>
        ) : (
          <p className="panel panel-pad dek">Select an image to edit its alt text, caption and credit.</p>
        )}
      </aside>
    </div>
  );
}
