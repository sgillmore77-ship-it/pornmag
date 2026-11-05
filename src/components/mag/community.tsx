"use client";

import Link from "next/link";
import { createContext, use, useCallback, useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import {
  deleteCommentAction,
  editCommentAction,
  loadThreadAction,
  postCommentAction,
  reportCommentAction,
  reportContentAction,
  toggleSaveAction,
  updateProfileAction,
} from "@/app/[site]/(public)/community-actions";
import type { CommentView, ThreadState } from "@/data/community";

/**
 * Reader features on a story page. The page itself stays cached for
 * everyone; comments, the save state and the reader's identity load
 * separately after the page arrives.
 */

const COMMENT_REASONS: Record<string, string> = {
  spam: "Spam or advertising",
  harassment: "Harassment or abuse",
  hate: "Hate speech",
  personal_info: "Shares someone's personal information",
  minor: "Involves or sexualises a minor",
  other: "Something else",
};

const PAGE_REASONS: Record<string, string> = {
  consent: "I appear in this without my consent",
  underage: "Someone in this may be under 18",
  copyright: "Copyright or trademark",
  illegal: "Other illegal content",
  inaccurate: "Factual error",
  other: "Something else",
};

type Ctx = { contentId: string; thread: ThreadState | null | undefined; reload: () => Promise<void>; path: string };
const CommunityContext = createContext<Ctx | null>(null);

export function CommunityProvider({ contentId, path, children }: { contentId: string; path: string; children: ReactNode }) {
  const [thread, setThread] = useState<ThreadState | null | undefined>(undefined);
  const reload = useCallback(async () => {
    const res = await loadThreadAction(contentId);
    setThread(res.ok ? (res.data ?? null) : null);
  }, [contentId]);
  useEffect(() => {
    let live = true;
    loadThreadAction(contentId).then((res) => {
      if (live) setThread(res.ok ? (res.data ?? null) : null);
    });
    return () => {
      live = false;
    };
  }, [contentId]);
  return <CommunityContext value={{ contentId, thread, reload, path }}>{children}</CommunityContext>;
}

function useCommunity() {
  const c = use(CommunityContext);
  if (!c) throw new Error("CommunityProvider missing");
  return c;
}

const loginHref = (path: string, hash = "") => `/login?next=${encodeURIComponent(path + hash)}`;

// ---------------------------------------------------------------------------

export function SaveButton() {
  const { contentId, thread, path } = useCommunity();
  const [saved, setSaved] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const isSaved = saved ?? thread?.viewer?.saved ?? false;

  if (thread === undefined) return <span className="save-btn" aria-hidden style={{ visibility: "hidden" }}>Save</span>;
  if (!thread?.viewer)
    return (
      <Link className="save-btn" href={loginHref(path)}>
        <BookmarkIcon /> Save
      </Link>
    );
  return (
    <button
      type="button"
      className="save-btn"
      aria-pressed={isSaved}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await toggleSaveAction(contentId);
        if (res.ok) setSaved(!!res.data);
        setBusy(false);
      }}
    >
      <BookmarkIcon filled={isSaved} /> {isSaved ? "Saved" : "Save"}
    </button>
  );
}

function BookmarkIcon({ filled }: { filled?: boolean }) {
  return (
    <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6">
      <path d="M1.5 1.5h11v13l-5.5-3.6-5.5 3.6z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------

export function Comments() {
  const { thread, reload, path } = useCommunity();
  const [notice, setNotice] = useState<string | null>(null);

  if (thread === undefined)
    return (
      <section className="cmt" aria-busy="true" aria-label="Comments">
        <h2 className="disp cmt-h">Comments</h2>
        <p className="meta">Loading…</p>
      </section>
    );
  if (thread === null) return null;

  const v = thread.viewer;
  return (
    <section className="cmt" id="comments" aria-labelledby="comments-h">
      <h2 id="comments-h" className="disp cmt-h">
        Comments{thread.count > 0 && <span className="cmt-n"> {thread.count}</span>}
      </h2>

      {!thread.open ? (
        <p className="cmt-note">{thread.closedReason}</p>
      ) : !v ? (
        <p className="cmt-note">
          <Link href={loginHref(path, "#comments")}>Sign in</Link> or <Link href={`/register?next=${encodeURIComponent(path + "#comments")}`}>create an account</Link> to join the conversation.
        </p>
      ) : v.blocked ? (
        <p className="cmt-note">Your account can&apos;t comment on this site.</p>
      ) : !v.handle ? (
        <HandleForm onDone={reload} />
      ) : (
        <Composer
          onPosted={async (status) => {
            setNotice(status === "pending" ? "Thanks — your comment will appear once a moderator has checked it." : null);
            await reload();
          }}
          signedInAs={v.handle}
        />
      )}
      {notice && (
        <p role="status" className="cmt-note" style={{ marginTop: 12 }}>
          {notice}
        </p>
      )}

      {thread.comments.length === 0 ? (
        thread.open && <p className="meta" style={{ marginTop: 28 }}>No comments yet.</p>
      ) : (
        <ol className="cmt-list">
          {thread.comments.map((c) => (
            <CommentItem key={c.id} c={c} canReply={thread.open && !!v?.handle && !v.blocked} signedIn={!!v} />
          ))}
        </ol>
      )}
      <p className="cmt-rules meta">Be decent. No personal information, no harassment, nothing involving anyone under 18. Comments that break the rules are removed.</p>
    </section>
  );
}

function HandleForm({ onDone }: { onDone: () => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const res = await updateProfileAction({ handle: String(f.get("handle") ?? "") });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    await onDone();
  }
  return (
    <form onSubmit={submit} className="cmt-form">
      <label className="field" htmlFor={id}>
        Choose a public name
        <input id={id} name="handle" required minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]{3,24}" autoComplete="nickname" placeholder="e.g. night_owl" />
      </label>
      <p className="meta" style={{ textTransform: "none", letterSpacing: 0 }}>
        Shown next to your comments instead of your real name. Letters, numbers and underscores.
      </p>
      {error && <p role="alert" className="cmt-err">{error}</p>}
      <button className="btn btn-primary" disabled={busy}>
        Continue
      </button>
    </form>
  );
}

function Composer({
  parentId,
  onPosted,
  onCancel,
  signedInAs,
  autoFocus,
}: {
  parentId?: string;
  onPosted: (status: "approved" | "pending") => Promise<void>;
  onCancel?: () => void;
  signedInAs?: string;
  autoFocus?: boolean;
}) {
  const { contentId } = useCommunity();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await postCommentAction({ contentId, parentId: parentId ?? null, body });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setBody("");
    await onPosted(res.data!.status);
  }
  return (
    <form onSubmit={submit} className="cmt-form">
      <label htmlFor={id} className="sr-only">
        {parentId ? "Your reply" : "Your comment"}
      </label>
      <textarea
        id={id}
        className="cmt-input"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={parentId ? 3 : 4}
        maxLength={2000}
        required
        autoFocus={autoFocus}
        placeholder={parentId ? "Write a reply" : "Add to the conversation"}
      />
      {error && <p role="alert" className="cmt-err">{error}</p>}
      <div className="cmt-actions">
        {signedInAs && <span className="meta">Posting as @{signedInAs}</span>}
        <span style={{ flex: 1 }} />
        {body.length > 1800 && <span className="meta">{2000 - body.length} left</span>}
        {onCancel && (
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button className="btn btn-primary" disabled={busy || body.trim().length < 2}>
          {parentId ? "Reply" : "Post"}
        </button>
      </div>
    </form>
  );
}

function timeAgo(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function CommentItem({ c, canReply, signedIn, isReply }: { c: CommentView; canReply: boolean; signedIn: boolean; isReply?: boolean }) {
  const { reload } = useCommunity();
  const [mode, setMode] = useState<null | "reply" | "edit" | "report">(null);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <li id={`comment-${c.id}`} className={`cmt-item${isReply ? " is-reply" : ""}`}>
      {c.status === "removed" ? (
        <p className="cmt-removed">This comment was removed.</p>
      ) : (
        <>
          <div className="cmt-meta">
            {c.author?.handle ? (
              <Link href={`/u/${c.author.handle}`} className="cmt-author">
                {c.author.name}
              </Link>
            ) : (
              <span className="cmt-author">{c.author?.name}</span>
            )}
            {c.author?.staff && <span className="chip cmt-staff">Staff</span>}
            <time dateTime={c.createdAt} title={new Date(c.createdAt).toLocaleString()}>
              {timeAgo(c.createdAt)}
            </time>
            {c.edited && <span>· edited</span>}
            {c.status === "pending" && <span className="cmt-pending">Awaiting approval · only you can see this</span>}
          </div>
          {mode === "edit" ? (
            <EditForm c={c} onDone={async () => { setMode(null); await reload(); }} onCancel={() => setMode(null)} />
          ) : (
            <p className="cmt-body">{c.body}</p>
          )}
          {mode !== "edit" && (
            <div className="cmt-tools">
              {canReply && c.status === "approved" && (
                <button type="button" onClick={() => setMode(mode === "reply" ? null : "reply")}>
                  Reply
                </button>
              )}
              {c.canEdit && (
                <button type="button" onClick={() => setMode("edit")}>
                  Edit
                </button>
              )}
              {c.mine && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm("Delete this comment?")) return;
                    const res = await deleteCommentAction(c.id);
                    if (res.ok) await reload();
                    else setMsg(res.error);
                  }}
                >
                  Delete
                </button>
              )}
              {signedIn && !c.mine && c.status === "approved" && (
                <button type="button" onClick={() => setMode(mode === "report" ? null : "report")}>
                  Report
                </button>
              )}
            </div>
          )}
          {msg && <p role="status" className="cmt-note">{msg}</p>}
          {mode === "report" && (
            <ReportCommentForm
              id={c.id}
              onDone={(m) => {
                setMode(null);
                setMsg(m);
              }}
            />
          )}
          {mode === "reply" && (
            <Composer
              parentId={c.id}
              autoFocus
              onCancel={() => setMode(null)}
              onPosted={async (status) => {
                setMode(null);
                setMsg(status === "pending" ? "Thanks — your reply will appear once a moderator has checked it." : null);
                await reload();
              }}
            />
          )}
        </>
      )}
      {c.replies.length > 0 && (
        <ol className="cmt-replies">
          {c.replies.map((r) => (
            <CommentItem key={r.id} c={r} canReply={canReply} signedIn={signedIn} isReply />
          ))}
        </ol>
      )}
    </li>
  );
}

function EditForm({ c, onDone, onCancel }: { c: CommentView; onDone: () => Promise<void>; onCancel: () => void }) {
  const [body, setBody] = useState(c.body);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="cmt-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await editCommentAction(c.id, body);
        if (!res.ok) return setError(res.error);
        await onDone();
      }}
    >
      <textarea className="cmt-input" aria-label="Edit your comment" value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={2000} autoFocus />
      {error && <p role="alert" className="cmt-err">{error}</p>}
      <div className="cmt-actions">
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-outline" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary">Save</button>
      </div>
    </form>
  );
}

function ReportCommentForm({ id, onDone }: { id: string; onDone: (msg: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="cmt-report"
      onSubmit={async (e) => {
        e.preventDefault();
        const reason = String(new FormData(e.currentTarget).get("reason") ?? "");
        const res = await reportCommentAction(id, reason);
        if (!res.ok) return setError(res.error);
        onDone("Thanks. A moderator will review it.");
      }}
    >
      <fieldset>
        <legend className="meta">Why are you reporting this?</legend>
        {Object.entries(COMMENT_REASONS).map(([k, label]) => (
          <label key={k}>
            <input type="radio" name="reason" value={k} required /> {label}
          </label>
        ))}
      </fieldset>
      {error && <p role="alert" className="cmt-err">{error}</p>}
      <button className="btn btn-ink">Send report</button>
    </form>
  );
}

// ---------------------------------------------------------------------------

/** "Report this page": takedown, consent and legal concerns. Works signed out. */
export function ReportPage() {
  const { contentId, thread } = useCommunity();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signedIn = !!thread?.viewer;

  return (
    <details className="report-page">
      <summary className="meta">Report this page</summary>
      {sent ? (
        <p role="status" className="cmt-note">
          Thank you. Your report has been sent to the editors{signedIn ? "" : ", and we'll reply by email if we need more detail"}.
        </p>
      ) : (
        <form
          className="cmt-report"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            const res = await reportContentAction({
              contentId,
              reason: String(f.get("reason") ?? ""),
              details: String(f.get("details") ?? ""),
              email: String(f.get("email") ?? ""),
            });
            setBusy(false);
            if (!res.ok) return setError(res.error);
            setSent(true);
          }}
        >
          <fieldset>
            <legend className="meta">What&apos;s the problem?</legend>
            {Object.entries(PAGE_REASONS).map(([k, label]) => (
              <label key={k}>
                <input type="radio" name="reason" value={k} required /> {label}
              </label>
            ))}
          </fieldset>
          <label className="field">
            Details (optional)
            <textarea name="details" className="cmt-input" rows={3} maxLength={4000} />
          </label>
          {!signedIn && (
            <label className="field">
              Your email, so we can reply
              <input name="email" type="email" required autoComplete="email" />
            </label>
          )}
          {error && <p role="alert" className="cmt-err">{error}</p>}
          <button className="btn btn-ink" disabled={busy}>
            Send report
          </button>
        </form>
      )}
    </details>
  );
}
