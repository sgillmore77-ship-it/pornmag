import Link from "next/link";
import { Empty, PageHead } from "@/components/admin/bits";
import { ModerationQueue } from "@/components/admin/moderation";
import { listCommentsForModeration, MOD_PAGE_SIZE, MOD_VIEWS, moderationCounts, type ModView } from "@/data/admin/moderation";
import { requireAdminPage } from "@/lib/admin";

const LABEL: Record<ModView, string> = { pending: "Waiting", reported: "Reported", approved: "Published", removed: "Removed" };
const EMPTY: Record<ModView, string> = {
  pending: "Nothing waiting. New comments that need a check appear here.",
  reported: "No open reports.",
  approved: "No published comments yet.",
  removed: "Nothing has been removed.",
};

export default async function CommentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const a = await requireAdminPage("comments.moderate");
  const sp = await searchParams;
  const view = MOD_VIEWS.find((v) => v === sp.view) ?? "pending";
  const page = Math.max(1, Number(sp.page) || 1);
  const [{ items, total }, counts] = await Promise.all([listCommentsForModeration(a.db, a.ctx.site, view, page), moderationCounts(a.db, a.ctx.site)]);
  const mode = a.ctx.publication.settings.commentModeration ?? "first";
  const qs = (v: ModView, p?: number) => `/admin/comments?view=${v}${p && p > 1 ? `&page=${p}` : ""}`;

  return (
    <>
      <PageHead
        title="Comments"
        sub={
          mode === "off"
            ? "Comments are switched off for the whole site (Settings)."
            : mode === "all"
              ? "Every new comment waits here for approval."
              : mode === "first"
                ? "A reader's first comment waits here; once one is approved, later ones go straight up. Comments with lots of links and reported comments come back here too."
                : "Comments go up straight away. Reported comments come back here."
        }
      />
      <div className="tabs">
        {MOD_VIEWS.map((v) => (
          <Link key={v} href={qs(v)} aria-current={view === v ? "page" : undefined}>
            {LABEL[v]}
            {v === "pending" && counts.pending ? ` (${counts.pending})` : ""}
            {v === "reported" && counts.reported ? ` (${counts.reported})` : ""}
          </Link>
        ))}
      </div>
      {items.length === 0 ? (
        <Empty>{EMPTY[view]}</Empty>
      ) : (
        <ModerationQueue
          key={`${view}-${page}`}
          view={view}
          items={items.map((c) => ({
            id: c.id,
            body: c.body,
            status: c.status,
            createdAt: c.createdAt.toISOString(),
            isReply: !!c.parentId,
            item: c.item,
            author: { userId: c.author.userId, handle: c.author.handle, name: c.author.name, email: c.author.email, blocked: c.author.blocked, staff: c.author.role !== "user" },
            reports: c.reports,
          }))}
        />
      )}
      {total > MOD_PAGE_SIZE && (
        <nav className="toolbar label-mono" style={{ justifyContent: "space-between", marginTop: 16 }}>
          {page > 1 ? <Link href={qs(view, page - 1)}>← Previous</Link> : <span />}
          {page * MOD_PAGE_SIZE < total ? <Link href={qs(view, page + 1)}>Next →</Link> : <span />}
        </nav>
      )}
    </>
  );
}
