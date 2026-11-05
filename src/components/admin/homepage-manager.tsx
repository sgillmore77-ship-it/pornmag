"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveHomepageAction, setLayoutAction } from "@/app/[site]/admin/actions";

type Pick = { id: string; name: string };
export type SectionState = {
  id: string;
  kind: string;
  enabled: boolean;
  title: string;
  limit: number | "";
  picks: Pick[];
};

const LABEL: Record<string, { name: string; picks: "content" | "category" | null; help: string }> = {
  hero: { name: "Cover story", picks: "content", help: "Pick the cover story, or leave empty to use the newest featured story." },
  latest: { name: "Latest stories", picks: null, help: "Newest features, automatically." },
  featured_reviews: { name: "Reviews", picks: "content", help: "Pinned reviews first, then the newest." },
  trending: { name: "Trending", picks: null, help: "Most read in the last 7 days, automatically." },
  featured_videos: { name: "Videos", picks: "content", help: "Pinned videos first, then the newest." },
  editors_picks: { name: "Editor's picks", picks: "content", help: "Only shows what you pick here." },
  categories: { name: "Popular categories", picks: "category", help: "Pick categories, or leave empty to show all with content." },
  latest_news: { name: "News", picks: null, help: "Newest news items, automatically." },
  newsletter: { name: "Newsletter", picks: null, help: "Not available yet: needs an email provider. Leave hidden." },
};

export function HomepageManager({
  initial,
  layout,
  content,
  categories,
}: {
  initial: SectionState[];
  layout: "issue" | "feed";
  content: (Pick & { type: string })[];
  categories: Pick[];
}) {
  const router = useRouter();
  const [sections, setSections] = useState(initial);
  const [lay, setLay] = useState(layout);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();

  const update = (i: number, patch: Partial<SectionState>) => {
    setSections((s) => s.map((x, k) => (k === i ? { ...x, ...patch } : x)));
    setDirty(true);
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= sections.length) return;
    setSections((s) => {
      const c = s.slice();
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
    setDirty(true);
  };

  function saveAll() {
    start(async () => {
      const r = await saveHomepageAction({
        sections: sections.map((s) => {
          const kind = LABEL[s.kind]?.picks;
          return {
            id: s.id,
            enabled: s.enabled,
            title: s.title,
            limit: s.limit === "" ? undefined : Number(s.limit),
            contentIds: kind === "content" ? s.picks.map((p) => p.id) : [],
            categoryIds: kind === "category" ? s.picks.map((p) => p.id) : [],
          };
        }),
      });
      setNotice(r.ok ? { ok: true, text: "Homepage updated. Live now." } : { ok: false, text: r.error });
      if (r.ok) {
        setDirty(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="form-grid">
      <section className="panel">
        <div className="panel-head">
          <h2>Layout</h2>
        </div>
        <div className="panel-pad" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          {(
            [
              ["issue", "The Issue", "Cover-led: giant masthead, full-bleed cover story, big review scores."],
              ["feed", "The Feed", "Grid-led: split hero, rails of reviews and picks, more on screen."],
            ] as const
          ).map(([key, name, desc]) => (
            <button
              key={key}
              type="button"
              className="panel panel-pad"
              aria-pressed={lay === key}
              disabled={pending}
              style={{ textAlign: "left", cursor: "pointer", borderWidth: 2, borderColor: lay === key ? "var(--brand)" : "var(--line)", font: "inherit", color: "inherit" }}
              onClick={() =>
                start(async () => {
                  const r = await setLayoutAction(key);
                  if (r.ok) {
                    setLay(key);
                    setNotice({ ok: true, text: `Switched to ${name}. Live now.` });
                    router.refresh();
                  } else setNotice({ ok: false, text: r.error });
                })
              }
            >
              <strong style={{ display: "block", marginBottom: 4 }}>
                {name} {lay === key && <span className="status status-published" style={{ marginLeft: 6 }}>Active</span>}
              </strong>
              <span style={{ color: "var(--muted)", fontSize: 14 }}>{desc}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Sections, top to bottom</h2>
          <div className="toolbar">
            {dirty && <span style={{ fontSize: 12, color: "var(--muted)" }}>Unsaved changes</span>}
            <button type="button" className="btn btn-primary btn-sm" disabled={pending || !dirty} onClick={saveAll}>
              {pending ? "Saving…" : "Save homepage"}
            </button>
          </div>
        </div>
        {notice && (
          <p className={`notice ${notice.ok ? "notice-ok" : "notice-err"}`} style={{ margin: 16 }}>
            {notice.text}
          </p>
        )}
        {sections.map((s, i) => {
          const meta = LABEL[s.kind] ?? { name: s.kind, picks: null, help: "" };
          const options = meta.picks === "category" ? categories : meta.picks === "content" ? content.filter((c) => (s.kind === "featured_reviews" ? c.type === "review" : s.kind === "featured_videos" ? c.type === "video" : true)) : [];
          const left = options.filter((o) => !s.picks.some((p) => p.id === o.id));
          return (
            <div key={s.id} className="sortable-row" style={{ opacity: s.enabled ? 1 : 0.55, alignItems: "start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <button type="button" className="btn btn-sm" style={{ padding: 0, width: 32 }} aria-label={`Move ${meta.name} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button type="button" className="btn btn-sm" style={{ padding: 0, width: 32 }} aria-label={`Move ${meta.name} down`} disabled={i === sections.length - 1} onClick={() => move(i, 1)}>
                  ↓
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
                <div>
                  <strong>{meta.name}</strong>
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>{meta.help}</div>
                </div>
                <div className="form-2">
                  <label className="f">
                    <span>Heading override</span>
                    <input type="text" value={s.title} placeholder="Default for the layout" maxLength={80} onChange={(e) => update(i, { title: e.target.value })} />
                  </label>
                  {s.kind !== "hero" && s.kind !== "newsletter" && (
                    <label className="f">
                      <span>How many</span>
                      <input type="number" min={1} max={24} value={s.limit} placeholder="Default" onChange={(e) => update(i, { limit: e.target.value === "" ? "" : Number(e.target.value) })} />
                    </label>
                  )}
                </div>
                {meta.picks && (
                  <div className="f">
                    <span>{meta.picks === "category" ? "Categories" : s.kind === "hero" ? "Cover story" : "Pinned"}</span>
                    {s.picks.map((p, k) => (
                      <div key={p.id} className="toolbar" style={{ justifyContent: "space-between", fontWeight: 400 }}>
                        <span>
                          {k + 1}. {p.name}
                        </span>
                        <button type="button" className="btn btn-sm" onClick={() => update(i, { picks: s.picks.filter((x) => x.id !== p.id) })}>
                          Remove
                        </button>
                      </div>
                    ))}
                    {(s.kind !== "hero" || s.picks.length === 0) && (
                      <select
                        className="inp"
                        value=""
                        aria-label={`Add to ${meta.name}`}
                        onChange={(e) => {
                          const o = options.find((x) => x.id === e.target.value);
                          if (o) update(i, { picks: [...s.picks, { id: o.id, name: o.name }] });
                        }}
                      >
                        <option value="">Add…</option>
                        {left.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
              <label className="check" style={{ whiteSpace: "nowrap" }}>
                <input type="checkbox" checked={s.enabled} disabled={s.kind === "newsletter" && !s.enabled} onChange={(e) => update(i, { enabled: e.target.checked })} />
                Shown
              </label>
            </div>
          );
        })}
      </section>
    </div>
  );
}
