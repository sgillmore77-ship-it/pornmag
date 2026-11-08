"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteMessageAction, setMessageHandledAction } from "@/app/[site]/admin/actions";
import { CONTACT_TOPICS, type ContactTopic } from "@/lib/contact-topics";

type Row = { id: string; name: string; email: string; topic: ContactTopic; message: string; createdAt: string; handledAt: string | null };

export function MessagesList({ rows, tz }: { rows: Row[]; tz?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: tz || "Europe/London" });

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Something went wrong");
      else router.refresh();
    });

  if (rows.length === 0) {
    return <div className="panel panel-pad" style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>No messages to deal with.</div>;
  }

  return (
    <div className="form-grid">
      {error && <p className="notice notice-err">{error}</p>}
      {rows.map((m) => {
        const subject = `Re: your message to us (${CONTACT_TOPICS[m.topic] ?? m.topic})`;
        return (
          <article key={m.id} className="panel panel-pad" style={{ opacity: m.handledAt ? 0.6 : 1 }}>
            <header style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", alignItems: "baseline", justifyContent: "space-between" }}>
              <div>
                <strong>{m.name}</strong>{" "}
                <a href={`mailto:${m.email}?subject=${encodeURIComponent(subject)}`} style={{ color: "var(--muted)" }}>
                  {m.email}
                </a>
              </div>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>
                {CONTACT_TOPICS[m.topic] ?? m.topic} · <time dateTime={m.createdAt}>{fmt.format(new Date(m.createdAt))}</time>
                {m.handledAt && " · done"}
              </span>
            </header>
            <p style={{ marginTop: 12, whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{m.message}</p>
            <div className="toolbar" style={{ marginTop: 14 }}>
              <a className="btn btn-sm btn-primary" href={`mailto:${m.email}?subject=${encodeURIComponent(subject)}`}>
                Reply by email
              </a>
              <button type="button" className="btn btn-sm" disabled={pending} onClick={() => act(() => setMessageHandledAction(m.id, !m.handledAt))}>
                {m.handledAt ? "Mark as open" : "Mark as done"}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                disabled={pending}
                onClick={() => window.confirm("Delete this message? This can't be undone.") && act(() => deleteMessageAction(m.id))}
              >
                Delete
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
