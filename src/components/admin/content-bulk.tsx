"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { bulkContentAction } from "@/app/[site]/admin/actions";

/**
 * Wraps the Content list table: rows carry `<input type="checkbox" name="ids">`
 * and a header `<input data-all>`; this adds the Archive / Delete bar.
 */
export function ContentBulk({ children }: { children: ReactNode }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [count, setCount] = useState(0);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const boxes = () => Array.from(form.current?.querySelectorAll<HTMLInputElement>('input[name="ids"]') ?? []);
  const sync = () => {
    const all = boxes();
    const n = all.filter((b) => b.checked).length;
    setCount(n);
    const head = form.current?.querySelector<HTMLInputElement>("input[data-all]");
    if (head) {
      head.checked = n > 0 && n === all.length;
      head.indeterminate = n > 0 && n < all.length;
    }
  };

  const act = (op: "archive" | "delete") => {
    const ids = boxes().filter((b) => b.checked).map((b) => b.value);
    if (!ids.length) return;
    const what = `${ids.length} ${ids.length === 1 ? "item" : "items"}`;
    if (op === "delete" && !window.confirm(`Permanently delete ${what}? This can't be undone. (Archive hides them but keeps them.)`)) return;
    start(async () => {
      const r = await bulkContentAction(op, ids);
      if (!r.ok) return setNotice({ ok: false, text: r.error });
      const n = r.data?.count ?? 0;
      setNotice({ ok: true, text: `${op === "archive" ? "Archived" : "Deleted"} ${n} ${n === 1 ? "item" : "items"}` });
      boxes().forEach((b) => (b.checked = false));
      sync();
      router.refresh();
    });
  };

  return (
    <form
      ref={form}
      onSubmit={(e) => e.preventDefault()}
      onChange={(e) => {
        const t = e.target as unknown as HTMLInputElement;
        if (t.dataset.all !== undefined) boxes().forEach((b) => (b.checked = t.checked));
        sync();
      }}
    >
      <div className="toolbar" style={{ marginBottom: 12, minHeight: 32 }}>
        <span className="label-mono" style={{ fontSize: 11 }}>{count ? `${count} ticked` : "Tick items to archive or delete several at once"}</span>
        <button type="button" className="btn btn-sm btn-outline" disabled={!count || pending} onClick={() => act("archive")}>
          Archive
        </button>
        <button type="button" className="btn btn-sm btn-danger" disabled={!count || pending} onClick={() => act("delete")}>
          Delete
        </button>
        {notice && <span className={`notice ${notice.ok ? "notice-ok" : "notice-err"}`} style={{ margin: 0 }}>{notice.text}</span>}
      </div>
      {children}
    </form>
  );
}
