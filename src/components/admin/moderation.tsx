"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  moderateCommentsAction,
  resolveReportAction,
  setCommentBlockAction,
  setRoleAction,
  unpublishReportedAction,
} from "@/app/[site]/admin/actions";

type Notice = { ok: boolean; text: string } | null;

function useAct() {
  const router = useRouter();
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, okText?: string) =>
    start(async () => {
      const r = await fn();
      setNotice(r.ok ? { ok: true, text: okText ?? r.message ?? "Done" } : { ok: false, text: r.error ?? "Failed" });
      if (r.ok) router.refresh();
    });
  return { notice, pending, act };
}

const REASONS: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment",
  hate: "Hate",
  personal_info: "Personal info",
  minor: "Involves a minor",
  other: "Other",
};

export type QueueItem = {
  id: string;
  body: string;
  status: string;
  createdAt: string;
  isReply: boolean;
  item: { title: string; path: string };
  author: { userId: string; handle: string | null; name: string; email: string; blocked: boolean; staff: boolean };
  reports: { reason: string; count: number }[];
};

export function ModerationQueue({ items, view }: { items: QueueItem[]; view: string }) {
  const { notice, pending, act } = useAct();
  const [sel, setSel] = useState<string[]>([]);
  const all = items.length > 0 && sel.length === items.length;
  const run = (ids: string[], action: "approve" | "remove" | "spam" | "dismiss") =>
    act(async () => {
      const r = await moderateCommentsAction(ids, action);
      if (r.ok) setSel([]);
      return r.ok ? { ok: true, message: `${r.data} ${r.data === 1 ? "comment" : "comments"} updated` } : r;
    });

  const bulk = (
    <>
      {view !== "approved" && <button className="btn btn-primary btn-sm" disabled={pending || !sel.length} onClick={() => run(sel, "approve")}>Approve</button>}
      {view !== "removed" && <button className="btn btn-sm btn-danger" disabled={pending || !sel.length} onClick={() => run(sel, "remove")}>Remove</button>}
      {view !== "removed" && <button className="btn btn-sm" disabled={pending || !sel.length} onClick={() => run(sel, "spam")}>Spam</button>}
      {view === "reported" && <button className="btn btn-sm" disabled={pending || !sel.length} onClick={() => run(sel, "dismiss")}>Dismiss reports</button>}
    </>
  );

  return (
    <div>
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
          <input type="checkbox" checked={all} onChange={() => setSel(all ? [] : items.map((i) => i.id))} disabled={!items.length} /> Select all
        </label>
        <span style={{ flex: 1 }} />
        {bulk}
      </div>
      {notice && <p className={`notice ${notice.ok ? "notice-ok" : "notice-err"}`} style={{ marginBottom: 12 }}>{notice.text}</p>}
      <ul className="mod-list">
        {items.map((c) => (
          <li key={c.id} className={`panel mod-item${c.reports.some((r) => r.reason === "minor") ? " is-urgent" : ""}`}>
            <input type="checkbox" aria-label="Select comment" checked={sel.includes(c.id)} onChange={() => setSel(sel.includes(c.id) ? sel.filter((x) => x !== c.id) : [...sel, c.id])} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="mod-meta">
                <strong>{c.author.name}</strong>
                {c.author.handle && <span>@{c.author.handle}</span>}
                <span>{c.author.email}</span>
                {c.author.staff && <span className="status status-published">staff</span>}
                {c.author.blocked && <span className="status status-archived">blocked</span>}
                <span>·</span>
                <time dateTime={c.createdAt}>{new Date(c.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</time>
                <span>·</span>
                <span>
                  {c.isReply ? "Reply on" : "On"}{" "}
                  <Link href={c.item.path} target="_blank" style={{ textDecoration: "underline" }}>
                    {c.item.title}
                  </Link>
                </span>
              </div>
              <p className="mod-body">{c.body || <em style={{ color: "var(--muted)" }}>Deleted by its author</em>}</p>
              {c.reports.length > 0 && (
                <p className="mod-reports">
                  Reported: {c.reports.map((r) => `${REASONS[r.reason] ?? r.reason}${r.count > 1 ? ` ×${r.count}` : ""}`).join(", ")}
                </p>
              )}
              <div className="toolbar" style={{ marginTop: 10 }}>
                {c.status !== "approved" && c.body && <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => run([c.id], "approve")}>Approve</button>}
                {(c.status === "approved" || c.status === "pending") && <button className="btn btn-sm btn-danger" disabled={pending} onClick={() => run([c.id], "remove")}>Remove</button>}
                {(c.status === "approved" || c.status === "pending") && <button className="btn btn-sm" disabled={pending} onClick={() => run([c.id], "spam")}>Spam</button>}
                {c.reports.length > 0 && <button className="btn btn-sm" disabled={pending} onClick={() => run([c.id], "dismiss")}>Dismiss reports</button>}
                {!c.author.staff && (
                  <button
                    className="btn btn-sm"
                    disabled={pending}
                    onClick={() => {
                      if (c.author.blocked) return act(() => setCommentBlockAction(c.author.userId, false));
                      const reason = window.prompt(`Block ${c.author.name} from commenting? Optional note for the team:`);
                      if (reason === null) return;
                      const removeAll = window.confirm("Also remove everything they've posted on this site?");
                      act(() => setCommentBlockAction(c.author.userId, true, reason, removeAll));
                    }}
                  >
                    {c.author.blocked ? "Unblock user" : "Block user"}
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type ReportRow = {
  id: string;
  reason: string;
  reasonLabel: string;
  details: string | null;
  email: string | null;
  createdAt: string;
  resolved: boolean;
  contentId: string;
  title: string;
  path: string;
  live: boolean;
};

export function ContentReports({ rows, canUnpublish }: { rows: ReportRow[]; canUnpublish: boolean }) {
  const { notice, pending, act } = useAct();
  return (
    <div>
      {notice && <p className={`notice ${notice.ok ? "notice-ok" : "notice-err"}`} style={{ marginBottom: 12 }}>{notice.text}</p>}
      <ul className="mod-list">
        {rows.map((r) => (
          <li key={r.id} className={`panel mod-item${["underage", "consent"].includes(r.reason) && !r.resolved ? " is-urgent" : ""}`}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="mod-meta">
                <strong>{r.reasonLabel}</strong>
                <span>·</span>
                <time dateTime={r.createdAt}>{new Date(r.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</time>
                <span>·</span>
                <Link href={r.live ? r.path : `/admin/content/${r.contentId}`} target="_blank" style={{ textDecoration: "underline" }}>
                  {r.title}
                </Link>
                {!r.live && <span className="status status-draft">offline</span>}
              </div>
              {r.details && <p className="mod-body">{r.details}</p>}
              <p className="mod-reports" style={{ color: "var(--muted)" }}>
                {r.email ? (
                  <>
                    Reply to <a href={`mailto:${r.email}`}>{r.email}</a>
                  </>
                ) : (
                  "No contact email"
                )}
              </p>
              <div className="toolbar" style={{ marginTop: 10 }}>
                {canUnpublish && r.live && (
                  <button
                    className="btn btn-sm btn-danger"
                    disabled={pending}
                    onClick={() => window.confirm(`Take "${r.title}" offline now? It moves back to drafts.`) && act(() => unpublishReportedAction(r.contentId))}
                  >
                    Take page offline
                  </button>
                )}
                <button className="btn btn-sm" disabled={pending} onClick={() => act(() => resolveReportAction(r.id, r.resolved))}>
                  {r.resolved ? "Reopen" : "Mark resolved"}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type PersonRow = {
  userId: string;
  name: string;
  email: string;
  handle: string | null;
  role: string;
  blocked: boolean;
  blockedReason: string | null;
  joinedAt: string;
  comments: number;
  self: boolean;
};

const ROLE_LABELS: Record<string, string> = { user: "Reader", moderator: "Moderator", author: "Author", editor: "Editor", admin: "Administrator" };

export function PeopleTable({ rows, canManageRoles, isAdmin }: { rows: PersonRow[]; canManageRoles: boolean; isAdmin: boolean }) {
  const { notice, pending, act } = useAct();
  return (
    <div>
      {notice && <p className={`notice ${notice.ok ? "notice-ok" : "notice-err"}`} style={{ marginBottom: 12 }}>{notice.text}</p>}
      <div className="panel tbl-wrap">
        <table className="tbl">
          <thead>
            <tr><th>Person</th><th>Role</th><th>Comments</th><th>Joined</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.userId}>
                <td>
                  <strong>{p.name}</strong>
                  {p.handle && <span style={{ color: "var(--muted)" }}> @{p.handle}</span>}
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>{p.email}</div>
                  {p.blocked && <div style={{ fontSize: 13, color: "#9b1c1c" }}>Blocked from commenting{p.blockedReason ? `: ${p.blockedReason}` : ""}</div>}
                </td>
                <td>
                  {canManageRoles && !p.self ? (
                    <select aria-label={`Role for ${p.name}`} value={p.role} disabled={pending} onChange={(e) => act(() => setRoleAction(p.userId, e.target.value as "user"))}>
                      {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  ) : (
                    ROLE_LABELS[p.role] ?? p.role
                  )}
                </td>
                <td>{p.comments}</td>
                <td>{new Date(p.joinedAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}</td>
                <td style={{ textAlign: "right" }}>
                  {!p.self && (p.role === "user" || isAdmin) && (
                    <button
                      className="btn btn-sm"
                      disabled={pending}
                      onClick={() => {
                        if (p.blocked) return act(() => setCommentBlockAction(p.userId, false));
                        const reason = window.prompt(`Block ${p.name} from commenting? Optional note for the team:`);
                        if (reason !== null) act(() => setCommentBlockAction(p.userId, true, reason, false));
                      }}
                    >
                      {p.blocked ? "Unblock" : "Block"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} style={{ color: "var(--muted)" }}>No one matches.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
