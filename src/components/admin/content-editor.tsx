"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { deleteContentAction, saveContentAction } from "@/app/[site]/admin/actions";
import type { RichTextDoc } from "@/db/schema";
import { MediaPicker, MediaThumb, type PickedMedia } from "./media-picker";
import { RichEditor } from "./rich-editor";

type Option = { id: string; name: string };
type Status = "draft" | "scheduled" | "published" | "archived";
type CType = "article" | "review" | "video" | "news";

export type EditorInitial = {
  id: string | null;
  type: CType;
  status: Status;
  title: string;
  slug: string;
  standfirst: string;
  body: RichTextDoc | null;
  scheduledFor: string | null; // ISO
  publishedAt: string | null; // ISO
  categoryId: string;
  heroImage: PickedMedia | null;
  ogImage: PickedMedia | null;
  authorIds: string[];
  tagNames: string[];
  related: Option[];
  isFeatured: boolean;
  commentsEnabled: boolean;
  seoTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  robotsIndex: boolean;
};

const SECTION: Record<CType, string> = { article: "features", review: "reviews", video: "videos", news: "news" };
const TYPE_LABEL: Record<CType, string> = { article: "Feature", review: "Review", video: "Video", news: "News" };

function slugify(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

/** ISO → value for <input type="datetime-local"> in the browser's time zone. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function AutoGrow(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [props.value]);
  return <textarea ref={ref} rows={1} {...props} />;
}

function ImageField({ label, value, onChange }: { label: string; value: PickedMedia | null; onChange: (m: PickedMedia | null) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="f">
      <span>{label}</span>
      {value ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <MediaThumb m={value} ratio="16/9" />
          <div className="toolbar">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(true)}>
              Change
            </button>
            <button type="button" className="btn btn-sm" onClick={() => onChange(null)}>
              Remove
            </button>
          </div>
          {!value.alt && <span className="hint" style={{ color: "#9b1c1c" }}>This image has no alt text. Add it in Media.</span>}
        </div>
      ) : (
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(true)} style={{ alignSelf: "flex-start" }}>
          Choose image
        </button>
      )}
      <MediaPicker open={open} onClose={() => setOpen(false)} onPick={onChange} />
    </div>
  );
}

function TagInput({ value, onChange, suggestions }: { value: string[]; onChange: (v: string[]) => void; suggestions: string[] }) {
  const [draft, setDraft] = useState("");
  const add = (t: string) => {
    const name = t.trim();
    if (name && !value.some((v) => v.toLowerCase() === name.toLowerCase())) onChange([...value, name]);
    setDraft("");
  };
  return (
    <div className="chips-input">
      {value.map((t) => (
        <span key={t} className="chip">
          {t}
          <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((v) => v !== t))}>
            ×
          </button>
        </span>
      ))}
      <input
        list="tag-suggestions"
        value={draft}
        placeholder={value.length ? "" : "Add tags"}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => draft && add(draft)}
        aria-label="Add tag"
      />
      <datalist id="tag-suggestions">
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
}

function Counter({ n, max }: { n: number; max: number }) {
  return <span className={`count ${n > max ? "over" : ""}`}>{n}/{max}</span>;
}

export function ContentEditor({
  initial,
  categories,
  authors,
  tagSuggestions,
  relatable,
  canPublish,
  canDelete,
  origin,
  siteName,
}: {
  initial: EditorInitial;
  categories: Option[];
  authors: Option[];
  tagSuggestions: string[];
  relatable: Option[];
  canPublish: boolean;
  canDelete: boolean;
  origin: string;
  siteName: string;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [body, setBody] = useState<RichTextDoc | null>(initial.body);
  const [slugTouched, setSlugTouched] = useState(!!initial.id);
  const [scheduled, setScheduled] = useState(toLocalInput(initial.scheduledFor));
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const [relatedPick, setRelatedPick] = useState("");

  const set = <K extends keyof EditorInitial>(k: K, val: EditorInitial[K]) => {
    setV((x) => ({ ...x, [k]: val }));
    setDirty(true);
  };

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const slug = slugTouched ? v.slug : slugify(v.title);
  const path = `/${SECTION[v.type]}/${slug || "…"}`;
  const seoTitle = v.seoTitle || v.title;
  const seoDesc = v.metaDescription || v.standfirst;

  const statusOptions: Status[] = canPublish ? ["draft", "scheduled", "published", "archived"] : ["draft"];
  const relatedLeft = useMemo(() => relatable.filter((r) => r.id !== v.id && !v.related.some((x) => x.id === r.id)), [relatable, v.related, v.id]);

  function save(statusOverride?: Status) {
    const status = statusOverride ?? v.status;
    setNotice(null);
    start(async () => {
      const r = await saveContentAction({
        id: v.id ?? undefined,
        type: v.type,
        title: v.title,
        slug,
        standfirst: v.standfirst,
        // Plain JSON only: editor objects can carry prototypes and getters.
        body: body ? (JSON.parse(JSON.stringify(body)) as RichTextDoc) : { type: "doc", content: [] },
        status,
        scheduledFor: status === "scheduled" && scheduled ? new Date(scheduled).toISOString() : undefined,
        categoryId: v.categoryId,
        heroImageId: v.heroImage?.id,
        ogImageId: v.ogImage?.id,
        authorIds: v.authorIds,
        tagNames: v.tagNames,
        relatedIds: v.related.map((r) => r.id),
        isFeatured: v.isFeatured,
        commentsEnabled: v.commentsEnabled,
        seoTitle: v.seoTitle,
        metaDescription: v.metaDescription,
        canonicalUrl: v.canonicalUrl,
        robotsIndex: v.robotsIndex,
      });
      if (!r.ok) {
        setNotice({ ok: false, text: r.error });
        return;
      }
      setDirty(false);
      setV((x) => ({ ...x, status, id: r.data!.id, slug: r.data!.slug }));
      setSlugTouched(true);
      const msg = status === "published" ? "Published. Live on the site now." : status === "scheduled" ? "Scheduled." : "Saved.";
      setNotice({ ok: true, text: msg });
      if (!v.id) router.replace(`/admin/content/${r.data!.id}`);
      else router.refresh();
    });
  }

  return (
    <div className="editor-layout">
      <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
        <div className="toolbar" style={{ justifyContent: "space-between" }}>
          <Link href="/admin/content" className="label-mono" style={{ fontSize: 10 }}>
            ← All content
          </Link>
          {v.id && v.status === "published" && (
            <Link href={`/${SECTION[v.type]}/${v.slug}`} target="_blank" className="label-mono" style={{ fontSize: 10 }}>
              View live ↗
            </Link>
          )}
        </div>
        <div className="panel panel-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <span className="kicker">{TYPE_LABEL[v.type]}</span>
          <AutoGrow className="title-input" value={v.title} placeholder="Headline" aria-label="Headline" maxLength={200} onChange={(e) => set("title", e.target.value.replace(/\n/g, " "))} />
          <AutoGrow className="standfirst-input" value={v.standfirst} placeholder="Standfirst: one or two sentences that sell the story" aria-label="Standfirst" maxLength={600} onChange={(e) => set("standfirst", e.target.value)} />
        </div>
        <RichEditor
          initial={initial.body}
          onChange={(d) => {
            setBody(d);
            setDirty(true);
          }}
        />

        <section className="panel">
          <div className="panel-head">
            <h2>Search &amp; sharing</h2>
          </div>
          <div className="panel-pad form-grid">
            <div className="notice" aria-label="Search result preview">
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                {siteName} · {origin.replace(/^https?:\/\//, "")}
                {path}
              </div>
              <div style={{ fontSize: 19, color: "#1a0dab", margin: "2px 0" }}>{seoTitle || "Headline"}</div>
              <div style={{ fontSize: 14, color: "var(--muted)" }}>{seoDesc ? (seoDesc.length > 160 ? `${seoDesc.slice(0, 157)}…` : seoDesc) : "Meta description"}</div>
            </div>
            <label className="f">
              <span>
                URL slug <span className="hint">{path}</span>
              </span>
              <input
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", slugify(e.target.value));
                }}
              />
              {v.status === "published" && slug !== initial.slug && initial.id && <span className="hint" style={{ color: "#8a5a00" }}>Changing a live URL breaks links. Add a redirect from the old URL in Redirects.</span>}
            </label>
            <label className="f">
              <span style={{ display: "flex", justifyContent: "space-between" }}>
                SEO title <Counter n={v.seoTitle.length} max={60} />
              </span>
              <input type="text" value={v.seoTitle} placeholder={v.title} maxLength={120} onChange={(e) => set("seoTitle", e.target.value)} />
            </label>
            <label className="f">
              <span style={{ display: "flex", justifyContent: "space-between" }}>
                Meta description <Counter n={v.metaDescription.length} max={160} />
              </span>
              <textarea value={v.metaDescription} placeholder={v.standfirst || "Defaults to the standfirst"} maxLength={320} onChange={(e) => set("metaDescription", e.target.value)} />
            </label>
            <label className="f">
              <span>
                Canonical URL <span className="hint">Only if this was first published elsewhere</span>
              </span>
              <input type="url" value={v.canonicalUrl} placeholder="https://…" onChange={(e) => set("canonicalUrl", e.target.value)} />
            </label>
            <ImageField label="Social share image (defaults to the hero image)" value={v.ogImage} onChange={(m) => set("ogImage", m)} />
            <label className="check">
              <input type="checkbox" checked={!v.robotsIndex} onChange={(e) => set("robotsIndex", !e.target.checked)} />
              Hide from search engines (noindex)
            </label>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Related stories</h2>
            <span className="hint" style={{ fontSize: 12, color: "var(--muted)" }}>
              Shown first under the story; the rest are picked automatically.
            </span>
          </div>
          <div className="panel-pad form-grid">
            {v.related.map((r, i) => (
              <div key={r.id} className="toolbar" style={{ justifyContent: "space-between" }}>
                <span>
                  {i + 1}. {r.name}
                </span>
                <button type="button" className="btn btn-sm" onClick={() => set("related", v.related.filter((x) => x.id !== r.id))}>
                  Remove
                </button>
              </div>
            ))}
            {v.related.length < 12 && (
              <div className="toolbar">
                <select className="inp" value={relatedPick} onChange={(e) => setRelatedPick(e.target.value)} aria-label="Add a related story" style={{ maxWidth: 480 }}>
                  <option value="">Add a related story…</option>
                  {relatedLeft.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={!relatedPick}
                  onClick={() => {
                    const r = relatable.find((x) => x.id === relatedPick);
                    if (r) set("related", [...v.related, r]);
                    setRelatedPick("");
                  }}
                >
                  Add
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      <aside className="editor-side" aria-label="Publishing">
        <section className="panel panel-pad form-grid">
          {notice && (
            <p className={`notice ${notice.ok ? "notice-ok" : "notice-err"}`} role="status">
              {notice.text}
            </p>
          )}
          <label className="f">
            <span>Status</span>
            <select value={v.status} onChange={(e) => set("status", e.target.value as Status)}>
              {statusOptions.map((s) => (
                <option key={s} value={s} style={{ textTransform: "capitalize" }}>
                  {s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
              {!statusOptions.includes(v.status) && <option value={v.status}>{v.status}</option>}
            </select>
            {!canPublish && <span className="hint">An editor reviews and publishes your story.</span>}
          </label>
          {v.status === "scheduled" && (
            <label className="f">
              <span>
                Publish at <span className="hint">your local time</span>
              </span>
              <input type="datetime-local" value={scheduled} onChange={(e) => (setScheduled(e.target.value), setDirty(true))} />
            </label>
          )}
          {v.publishedAt && v.status === "published" && <span className="hint" style={{ fontSize: 12, color: "var(--muted)" }}>First published {new Date(v.publishedAt).toLocaleString("en-GB")}</span>}
          <div className="toolbar">
            <button type="button" className="btn btn-primary" disabled={pending || !v.title.trim()} onClick={() => save()}>
              {pending ? "Saving…" : v.status === "published" ? (initial.status === "published" ? "Update" : "Publish") : v.status === "scheduled" ? "Schedule" : "Save"}
            </button>
            {dirty && <span className="hint" style={{ fontSize: 12, color: "var(--muted)" }}>Unsaved changes</span>}
          </div>
        </section>

        <section className="panel panel-pad form-grid">
          <label className="f">
            <span>Type</span>
            <select value={v.type} onChange={(e) => set("type", e.target.value as CType)}>
              {(Object.keys(TYPE_LABEL) as CType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="f">
            <span>Category</span>
            <select value={v.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="f" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ marginBottom: 6 }}>Byline</legend>
            <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid var(--line)", padding: "4px 10px" }}>
              {authors.map((a) => (
                <label key={a.id} className="check">
                  <input
                    type="checkbox"
                    checked={v.authorIds.includes(a.id)}
                    onChange={(e) => set("authorIds", e.target.checked ? [...v.authorIds, a.id] : v.authorIds.filter((x) => x !== a.id))}
                  />
                  {a.name}
                </label>
              ))}
            </div>
            {v.authorIds.length === 0 && !v.id && <span className="hint">Leave empty to use your own byline.</span>}
          </fieldset>
          <div className="f">
            <span>Tags</span>
            <TagInput value={v.tagNames} onChange={(t) => set("tagNames", t)} suggestions={tagSuggestions} />
          </div>
          <ImageField label="Hero image" value={v.heroImage} onChange={(m) => set("heroImage", m)} />
          <label className="check">
            <input type="checkbox" checked={v.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} />
            Featured (eligible for the cover story)
          </label>
          <label className="check">
            <input type="checkbox" checked={v.commentsEnabled} onChange={(e) => set("commentsEnabled", e.target.checked)} />
            Allow comments
          </label>
        </section>

        {canDelete && v.id && (
          <button
            type="button"
            className="btn btn-danger btn-sm"
            style={{ alignSelf: "flex-start" }}
            onClick={async () => {
              if (!confirm("Delete this story permanently? Archiving hides it without deleting.")) return;
              const r = await deleteContentAction(v.id!);
              if (r && !r.ok) setNotice({ ok: false, text: r.error });
            }}
          >
            Delete permanently
          </button>
        )}
      </aside>
    </div>
  );
}
