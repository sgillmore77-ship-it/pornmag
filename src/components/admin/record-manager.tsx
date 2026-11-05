"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/admin";

export type FieldSpec =
  | { key: string; label: string; kind: "text" | "textarea" | "number"; hint?: string; max?: number; placeholder?: string; counter?: number }
  | { key: string; label: string; kind: "checkbox"; hint?: string };

type Rec = { id: string; [k: string]: unknown };

/**
 * List + edit form for simple records (categories, tags, authors).
 * Save and delete are server actions passed in from the page.
 */
export function RecordManager({
  records,
  fields,
  columns,
  noun,
  empty,
  save,
  remove,
  viewBase,
}: {
  records: Rec[];
  fields: FieldSpec[];
  columns: { key: string; label: string; render?: "bool" | "count" }[];
  noun: string;
  empty: Record<string, unknown>;
  /** Server action; it validates its own input. */
  save: (input: never) => Promise<ActionResult<string>>;
  remove: (id: string) => Promise<ActionResult>;
  /** Public URL prefix; the record's slug is appended, e.g. "/category/". */
  viewBase?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const open = (r: Record<string, unknown>) => {
    setNotice(null);
    setEditing(Object.fromEntries([...fields.map((f) => [f.key, r[f.key] ?? (f.kind === "checkbox" ? false : "")]), ["id", r.id]]));
  };

  return (
    <div className="editor-layout">
      <div className="panel tbl-wrap" style={{ minWidth: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                {columns.map((c, i) => (
                  <td key={c.key}>
                    {c.render === "bool" ? (r[c.key] ? "Yes" : "No") : i === 0 ? (
                      <button type="button" className="t" style={{ background: "none", border: 0, padding: 0, cursor: "pointer", font: "inherit", textAlign: "left", color: "inherit" }} onClick={() => open(r)}>
                        {String(r[c.key] ?? "")}
                      </button>
                    ) : (
                      String(r[c.key] ?? "")
                    )}
                  </td>
                ))}
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  {viewBase && typeof r.slug === "string" && (
                    <a href={`${viewBase}${r.slug}`} target="_blank" rel="noreferrer" className="label-mono" style={{ fontSize: 10, marginRight: 12 }}>
                      View ↗
                    </a>
                  )}
                  <button type="button" className="btn btn-sm" onClick={() => open(r)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} style={{ color: "var(--muted)" }}>
                  None yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <aside className="editor-side">
        {!editing ? (
          <section className="panel panel-pad form-grid">
            {notice && <p className={`notice ${notice.ok ? "notice-ok" : "notice-err"}`}>{notice.text}</p>}
            <button type="button" className="btn btn-primary" onClick={() => open({ ...empty, id: undefined })}>
              New {noun}
            </button>
          </section>
        ) : (
          <form
            className="panel panel-pad form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const input = Object.fromEntries(
                  Object.entries(editing).map(([k, v]) => {
                    const f = fields.find((x) => x.key === k);
                    return [k, f?.kind === "number" ? Number(v) || 0 : v === "" ? undefined : v];
                  }),
                );
                const r = await save(input as never);
                if (!r.ok) return setNotice({ ok: false, text: r.error });
                setNotice({ ok: true, text: "Saved" });
                setEditing(null);
                router.refresh();
              });
            }}
          >
            <h2 style={{ fontSize: 15 }}>{editing.id ? `Edit ${noun}` : `New ${noun}`}</h2>
            {fields.map((f) =>
              f.kind === "checkbox" ? (
                <label key={f.key} className="check">
                  <input type="checkbox" checked={!!editing[f.key]} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.checked })} />
                  <span>
                    {f.label}
                    {f.hint && <span className="hint" style={{ display: "block", fontSize: 12, color: "var(--muted)", fontWeight: 400 }}>{f.hint}</span>}
                  </span>
                </label>
              ) : (
                <label key={f.key} className="f">
                  <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span>
                      {f.label} {f.hint && <span className="hint">{f.hint}</span>}
                    </span>
                    {f.counter && (
                      <span className={`count ${String(editing[f.key] ?? "").length > f.counter ? "over" : ""}`}>
                        {String(editing[f.key] ?? "").length}/{f.counter}
                      </span>
                    )}
                  </span>
                  {f.kind === "textarea" ? (
                    <textarea value={String(editing[f.key] ?? "")} maxLength={f.max} placeholder={f.placeholder} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} />
                  ) : (
                    <input type={f.kind === "number" ? "number" : "text"} value={String(editing[f.key] ?? "")} maxLength={f.max} placeholder={f.placeholder} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} />
                  )}
                </label>
              ),
            )}
            {notice && !notice.ok && <p className="notice notice-err">{notice.text}</p>}
            <div className="toolbar">
              <button className="btn btn-primary" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setEditing(null)}>
                Cancel
              </button>
              {typeof editing.id === "string" && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  style={{ marginLeft: "auto" }}
                  onClick={() => {
                    if (!confirm(`Delete this ${noun}?`)) return;
                    start(async () => {
                      const r = await remove(editing.id as string);
                      if (!r.ok) return setNotice({ ok: false, text: r.error });
                      setEditing(null);
                      setNotice({ ok: true, text: "Deleted" });
                      router.refresh();
                    });
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          </form>
        )}
      </aside>
    </div>
  );
}
