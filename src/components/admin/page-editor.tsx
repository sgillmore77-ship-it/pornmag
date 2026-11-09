"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deletePageAction, savePageAction } from "@/app/[site]/admin/actions";
import type { PageFooterGroup, RichTextDoc } from "@/db/schema";
import { CONTACT_TOPICS, type ContactTopic } from "@/lib/contact-topics";
import { RichEditor } from "./rich-editor";

export type PageEditorInitial = {
  id: string;
  title: string;
  slug: string;
  standfirst: string;
  body: RichTextDoc | null;
  published: boolean;
  footerGroup: PageFooterGroup | null;
  position: number;
  contactTopic: ContactTopic | null;
  seoTitle: string;
  metaDescription: string;
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function PageEditor({ initial, videoHosts = [] }: { initial: PageEditorInitial | null; videoHosts?: string[] }) {
  const router = useRouter();
  const [v, setV] = useState({
    title: initial?.title ?? "",
    slug: initial?.slug ?? "",
    standfirst: initial?.standfirst ?? "",
    published: initial?.published ?? true,
    footerGroup: initial?.footerGroup ?? null,
    position: initial?.position ?? 0,
    contactTopic: initial?.contactTopic ?? null,
    seoTitle: initial?.seoTitle ?? "",
    metaDescription: initial?.metaDescription ?? "",
  });
  const [body, setBody] = useState<RichTextDoc | null>(initial?.body ?? null);
  const [slugTouched, setSlugTouched] = useState(!!initial);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));

  return (
    <form
      className="form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await savePageAction({
            ...v,
            id: initial?.id,
            // Plain JSON for the server action (the editor's objects aren't serialisable as-is).
            body: body ? (JSON.parse(JSON.stringify(body)) as RichTextDoc) : null,
          });
          if (!r.ok) return setNotice({ ok: false, text: r.error });
          setNotice({ ok: true, text: "Page saved" });
          if (!initial && r.data) router.replace(`/admin/pages/${r.data.id}`);
          else router.refresh();
        });
      }}
    >
      <div className="panel panel-pad form-grid">
        <label className="f">
          <span>Title</span>
          <input
            type="text"
            value={v.title}
            maxLength={200}
            required
            onChange={(e) => {
              set("title", e.target.value);
              if (!slugTouched) set("slug", slugify(e.target.value));
            }}
          />
        </label>
        <label className="f">
          <span>Web address</span>
          <span className="hint">The page appears at /{v.slug || "…"}. Changing it breaks old links unless you add a redirect.</span>
          <input
            type="text"
            value={v.slug}
            maxLength={80}
            required
            onChange={(e) => {
              setSlugTouched(true);
              set("slug", e.target.value.toLowerCase());
            }}
          />
        </label>
        <label className="f">
          <span>Intro</span>
          <span className="hint">Optional. One or two sentences shown under the title.</span>
          <textarea value={v.standfirst} maxLength={400} onChange={(e) => set("standfirst", e.target.value)} />
        </label>
      </div>

      <div className="panel panel-pad">
        <RichEditor initial={initial?.body ?? null} onChange={setBody} videoHosts={videoHosts} />
      </div>

      <div className="panel panel-pad form-grid">
        <label className="check">
          <input type="checkbox" checked={v.published} onChange={(e) => set("published", e.target.checked)} />
          Published (visible on the site)
        </label>
        <div className="toolbar" style={{ alignItems: "flex-end" }}>
          <label className="f" style={{ flex: "1 1 200px" }}>
            <span>Footer link</span>
            <select value={v.footerGroup ?? ""} onChange={(e) => set("footerGroup", (e.target.value || null) as PageFooterGroup | null)}>
              <option value="">Not in the footer</option>
              <option value="about">About column</option>
              <option value="legal">Legal column</option>
            </select>
          </label>
          <label className="f" style={{ width: 120 }}>
            <span>Order</span>
            <input type="number" min={0} max={999} value={v.position} onChange={(e) => set("position", Number(e.target.value) || 0)} />
          </label>
        </div>
        <label className="f">
          <span>Contact form</span>
          <span className="hint">Shows a contact form under the text. Messages arrive in Admin → Messages.</span>
          <select value={v.contactTopic ?? ""} onChange={(e) => set("contactTopic", (e.target.value || null) as ContactTopic | null)}>
            <option value="">No form</option>
            {Object.entries(CONTACT_TOPICS).map(([k, label]) => (
              <option key={k} value={k}>
                Show form, topic: {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <details className="panel panel-pad">
        <summary style={{ fontWeight: 600, cursor: "pointer" }}>Search engines (optional)</summary>
        <div className="form-grid" style={{ marginTop: 14 }}>
          <label className="f">
            <span>Search title</span>
            <input type="text" value={v.seoTitle} maxLength={200} placeholder={v.title} onChange={(e) => set("seoTitle", e.target.value)} />
          </label>
          <label className="f">
            <span>Search description</span>
            <textarea value={v.metaDescription} maxLength={320} onChange={(e) => set("metaDescription", e.target.value)} />
          </label>
        </div>
      </details>

      {notice && <p className={`notice ${notice.ok ? "notice-ok" : "notice-err"}`}>{notice.text}</p>}
      <div className="toolbar">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save page"}</button>
        {initial && v.published && (
          <Link href={`/${initial.slug}`} target="_blank" className="btn btn-sm">
            View ↗
          </Link>
        )}
        <Link href="/admin/pages" className="btn btn-sm">Back to pages</Link>
        {initial && (
          <button
            type="button"
            className="btn btn-sm btn-danger"
            disabled={pending}
            style={{ marginLeft: "auto" }}
            onClick={() => {
              if (!window.confirm(`Delete “${initial.title}”? This can't be undone.`)) return;
              start(async () => {
                const r = await deletePageAction(initial.id);
                if (!r.ok) return setNotice({ ok: false, text: r.error });
                router.replace("/admin/pages");
              });
            }}
          >
            Delete page
          </button>
        )}
      </div>
    </form>
  );
}
