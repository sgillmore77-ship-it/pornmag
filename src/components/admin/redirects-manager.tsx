"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteRedirectAction, saveRedirectAction } from "@/app/[site]/admin/actions";

type R = { id: string; fromPath: string; toPath: string; statusCode: number; hits: number };

export function RedirectsManager({ rows }: { rows: R[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ fromPath: "", toPath: "", statusCode: 301 });
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="form-grid">
      <form
        className="panel panel-pad"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await saveRedirectAction(form);
            setNotice(r.ok ? { ok: true, text: "Redirect saved" } : { ok: false, text: r.error });
            if (r.ok) {
              setForm({ fromPath: "", toPath: "", statusCode: 301 });
              router.refresh();
            }
          });
        }}
      >
        <div className="toolbar" style={{ alignItems: "flex-end" }}>
          <label className="f" style={{ flex: "1 1 220px" }}><span>From</span><input type="text" value={form.fromPath} placeholder="/old-story" onChange={(e) => setForm({ ...form, fromPath: e.target.value })} /></label>
          <label className="f" style={{ flex: "1 1 220px" }}><span>To</span><input type="text" value={form.toPath} placeholder="/features/new-story" onChange={(e) => setForm({ ...form, toPath: e.target.value })} /></label>
          <label className="f"><span>Type</span>
            <select value={form.statusCode} onChange={(e) => setForm({ ...form, statusCode: Number(e.target.value) })}>
              <option value={301}>301 Permanent</option>
              <option value={302}>302 Temporary</option>
            </select>
          </label>
          <button className="btn btn-primary" disabled={pending}>Add</button>
        </div>
        {notice && <p className={`notice ${notice.ok ? "notice-ok" : "notice-err"}`} style={{ marginTop: 12 }}>{notice.text}</p>}
      </form>
      <div className="panel tbl-wrap">
        <table className="tbl">
          <thead><tr><th>From</th><th>To</th><th>Type</th><th>Used</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><code style={{ fontFamily: "var(--fm)", fontSize: 13 }}>{r.fromPath}</code></td>
                <td><code style={{ fontFamily: "var(--fm)", fontSize: 13 }}>{r.toPath}</code></td>
                <td>{r.statusCode}</td>
                <td>{r.hits}</td>
                <td style={{ textAlign: "right" }}>
                  <button type="button" className="btn btn-sm" onClick={() => start(async () => { const x = await deleteRedirectAction(r.id); if (x.ok) router.refresh(); else setNotice({ ok: false, text: x.error }); })}>Delete</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} style={{ color: "var(--muted)" }}>No redirects. Add one when you change or remove a URL.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
