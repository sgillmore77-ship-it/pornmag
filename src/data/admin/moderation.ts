import { and, count, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { commentReports, comments, contentItems, contentReports, memberships, users } from "@/db/schema";
import { contentPath } from "@/data/content";
import type { Site } from "@/data/site";
import { assertCan, type Actor, type Role } from "@/lib/permissions";

/** Comment moderation, content reports and people (roles, comment blocks). */

export const MOD_VIEWS = ["pending", "reported", "approved", "removed"] as const;
export type ModView = (typeof MOD_VIEWS)[number];
export const MOD_PAGE_SIZE = 40;

export async function moderationCounts(db: Db, s: Site) {
  const [[pending], [reported], [reports]] = await Promise.all([
    db.select({ n: count() }).from(comments).where(and(eq(comments.publicationId, s.publicationId), eq(comments.status, "pending"))),
    db
      .select({ n: sql<number>`count(distinct ${commentReports.commentId})::int` })
      .from(commentReports)
      .where(and(eq(commentReports.publicationId, s.publicationId), isNull(commentReports.resolvedAt))),
    db.select({ n: count() }).from(contentReports).where(and(eq(contentReports.publicationId, s.publicationId), isNull(contentReports.resolvedAt))),
  ]);
  return { pending: pending.n, reported: reported.n, contentReports: reports.n };
}

export type ModComment = {
  id: string;
  body: string;
  status: string;
  createdAt: Date;
  parentId: string | null;
  item: { title: string; path: string };
  author: { userId: string; handle: string | null; name: string; email: string; blocked: boolean; role: Role };
  reports: { reason: string; count: number }[];
};

export async function listCommentsForModeration(db: Db, s: Site, view: ModView, page = 1) {
  const base = eq(comments.publicationId, s.publicationId);
  let where;
  if (view === "reported") {
    const ids = db
      .selectDistinct({ id: commentReports.commentId })
      .from(commentReports)
      .where(and(eq(commentReports.publicationId, s.publicationId), isNull(commentReports.resolvedAt)));
    where = and(base, inArray(comments.id, ids));
  } else if (view === "removed") where = and(base, inArray(comments.status, ["removed", "rejected", "spam"]), isNotNull(comments.moderatedBy), sql`${comments.moderatedBy} <> ${comments.userId}`);
  else where = and(base, eq(comments.status, view));

  const [[{ total }], rows] = await Promise.all([
    db.select({ total: count() }).from(comments).where(where),
    db
      .select({
        id: comments.id,
        body: comments.body,
        status: comments.status,
        createdAt: comments.createdAt,
        parentId: comments.parentId,
        title: contentItems.title,
        type: contentItems.type,
        slug: contentItems.slug,
        userId: users.id,
        userName: users.name,
        email: users.email,
        handle: memberships.handle,
        displayName: memberships.displayName,
        blocked: memberships.commentsBlockedAt,
        role: memberships.role,
      })
      .from(comments)
      .innerJoin(contentItems, eq(contentItems.id, comments.contentId))
      .innerJoin(users, eq(users.id, comments.userId))
      .leftJoin(memberships, and(eq(memberships.publicationId, comments.publicationId), eq(memberships.userId, comments.userId)))
      .where(where)
      // The queue is first-in first-out; the archive shows newest first.
      .orderBy(view === "pending" ? comments.createdAt : desc(comments.createdAt))
      .limit(MOD_PAGE_SIZE)
      .offset((Math.max(1, page) - 1) * MOD_PAGE_SIZE),
  ]);

  const ids = rows.map((r) => r.id);
  const reportRows = ids.length
    ? await db
        .select({ commentId: commentReports.commentId, reason: commentReports.reason, n: count() })
        .from(commentReports)
        .where(and(inArray(commentReports.commentId, ids), isNull(commentReports.resolvedAt)))
        .groupBy(commentReports.commentId, commentReports.reason)
    : [];

  const items: ModComment[] = rows.map((r) => ({
    id: r.id,
    body: r.body,
    status: r.status,
    createdAt: r.createdAt,
    parentId: r.parentId,
    item: { title: r.title, path: `${contentPath(r)}#comment-${r.id}` },
    author: { userId: r.userId, handle: r.handle, name: r.displayName ?? r.handle ?? r.userName, email: r.email, blocked: !!r.blocked, role: r.role ?? "user" },
    reports: reportRows.filter((x) => x.commentId === r.id).map((x) => ({ reason: x.reason, count: x.n })),
  }));
  return { items, total };
}

export type ModAction = "approve" | "remove" | "spam" | "dismiss";

export async function moderateComments(db: Db, s: Site, actor: Actor, ids: string[], action: ModAction) {
  assertCan(actor, "comments.moderate");
  const wanted = [...new Set(ids)].slice(0, 200);
  if (!wanted.length) return 0;
  const owned = await db
    .select({ id: comments.id })
    .from(comments)
    .where(and(eq(comments.publicationId, s.publicationId), inArray(comments.id, wanted)));
  const okIds = owned.map((o) => o.id);
  if (!okIds.length) return 0;
  const now = new Date();
  await db.transaction(async (tx) => {
    if (action !== "dismiss") {
      const status = action === "approve" ? "approved" : action === "spam" ? "spam" : "removed";
      await tx.update(comments).set({ status, moderatedBy: actor.userId, moderatedAt: now }).where(inArray(comments.id, okIds));
    }
    await tx
      .update(commentReports)
      .set({ resolvedAt: now, resolvedBy: actor.userId })
      .where(and(inArray(commentReports.commentId, okIds), isNull(commentReports.resolvedAt)));
  });
  return okIds.length;
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

async function membership(db: Db, s: Site, userId: string) {
  const [m] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.publicationId, s.publicationId), eq(memberships.userId, userId)));
  if (!m) throw new Error("Unknown member");
  return m;
}

export async function setCommentBlock(db: Db, s: Site, actor: Actor, userId: string, blocked: boolean, reason?: string) {
  assertCan(actor, "comments.moderate");
  if (userId === actor.userId) throw new Error("You can't block yourself.");
  const m = await membership(db, s, userId);
  if (blocked && m.role !== "user" && !actor.isSuperAdmin && actor.role !== "admin") throw new Error("Only an administrator can block a team member.");
  await db
    .update(memberships)
    .set(blocked ? { commentsBlockedAt: new Date(), commentsBlockedReason: reason?.slice(0, 500) || null } : { commentsBlockedAt: null, commentsBlockedReason: null })
    .where(and(eq(memberships.publicationId, s.publicationId), eq(memberships.userId, userId)));
}

/** Removes everything a reader has posted here, e.g. after blocking a spammer. */
export async function removeAllComments(db: Db, s: Site, actor: Actor, userId: string) {
  assertCan(actor, "comments.moderate");
  await membership(db, s, userId);
  const rows = await db
    .update(comments)
    .set({ status: "removed", moderatedBy: actor.userId, moderatedAt: new Date() })
    .where(and(eq(comments.publicationId, s.publicationId), eq(comments.userId, userId), inArray(comments.status, ["approved", "pending"])))
    .returning({ id: comments.id });
  return rows.length;
}

export const ROLES: Role[] = ["user", "moderator", "author", "editor", "admin"];

export async function listPeople(db: Db, s: Site, f: { q?: string; role?: Role | "team" | "blocked"; page?: number }) {
  const where = [eq(memberships.publicationId, s.publicationId)];
  if (f.q) {
    const q = `%${f.q.replace(/[%_\\]/g, "\\$&")}%`;
    where.push(or(ilike(users.name, q), ilike(users.email, q), ilike(memberships.handle, q))!);
  }
  if (f.role === "team") where.push(sql`${memberships.role} <> 'user'`);
  else if (f.role === "blocked") where.push(isNotNull(memberships.commentsBlockedAt));
  else if (f.role) where.push(eq(memberships.role, f.role));
  const page = Math.max(1, f.page ?? 1);
  const [[{ total }], rows] = await Promise.all([
    db.select({ total: count() }).from(memberships).innerJoin(users, eq(users.id, memberships.userId)).where(and(...where)),
    db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        emailVerified: users.emailVerified,
        handle: memberships.handle,
        role: memberships.role,
        blockedAt: memberships.commentsBlockedAt,
        blockedReason: memberships.commentsBlockedReason,
        joinedAt: memberships.createdAt,
        comments: sql<number>`(select count(*)::int from ${comments} where ${comments.userId} = ${users.id} and ${comments.publicationId} = ${s.publicationId})`,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(...where))
      .orderBy(desc(memberships.createdAt))
      .limit(50)
      .offset((page - 1) * 50),
  ]);
  return { rows, total };
}

export async function setRole(db: Db, s: Site, actor: Actor, userId: string, role: Role) {
  assertCan(actor, "publication.manage");
  if (!ROLES.includes(role)) throw new Error("Unknown role");
  if (userId === actor.userId) throw new Error("You can't change your own role.");
  const m = await membership(db, s, userId);
  if (m.role === "admin" && role !== "admin") {
    const [{ n }] = await db
      .select({ n: count() })
      .from(memberships)
      .where(and(eq(memberships.publicationId, s.publicationId), eq(memberships.role, "admin")));
    if (n <= 1) throw new Error("A site needs at least one administrator.");
  }
  await db
    .update(memberships)
    .set({ role })
    .where(and(eq(memberships.publicationId, s.publicationId), eq(memberships.userId, userId)));
}

// ---------------------------------------------------------------------------
// Content reports
// ---------------------------------------------------------------------------

export async function listContentReports(db: Db, s: Site, open: boolean) {
  const rows = await db
    .select({
      id: contentReports.id,
      reason: contentReports.reason,
      details: contentReports.details,
      email: contentReports.reporterEmail,
      createdAt: contentReports.createdAt,
      resolvedAt: contentReports.resolvedAt,
      contentId: contentItems.id,
      title: contentItems.title,
      type: contentItems.type,
      slug: contentItems.slug,
      status: contentItems.status,
    })
    .from(contentReports)
    .innerJoin(contentItems, eq(contentItems.id, contentReports.contentId))
    .where(and(eq(contentReports.publicationId, s.publicationId), open ? isNull(contentReports.resolvedAt) : isNotNull(contentReports.resolvedAt)))
    // Safety reports first, then oldest first.
    .orderBy(sql`case ${contentReports.reason} when 'underage' then 0 when 'consent' then 1 when 'illegal' then 2 else 3 end`, open ? contentReports.createdAt : desc(contentReports.resolvedAt))
    .limit(100);
  return rows.map((r) => ({ ...r, path: contentPath(r) }));
}

export async function resolveContentReport(db: Db, s: Site, actor: Actor, id: string, reopen = false) {
  assertCan(actor, "comments.moderate");
  const res = await db
    .update(contentReports)
    .set(reopen ? { resolvedAt: null, resolvedBy: null } : { resolvedAt: new Date(), resolvedBy: actor.userId })
    .where(and(eq(contentReports.publicationId, s.publicationId), eq(contentReports.id, id)))
    .returning({ id: contentReports.id });
  if (!res.length) throw new Error("Report not found");
}

/** Takes a reported page offline straight away (back to draft). */
export async function unpublishContent(db: Db, s: Site, actor: Actor, contentId: string) {
  assertCan(actor, "content.publish");
  const res = await db
    .update(contentItems)
    .set({ status: "draft" })
    .where(and(eq(contentItems.publicationId, s.publicationId), eq(contentItems.id, contentId)))
    .returning({ id: contentItems.id });
  if (!res.length) throw new Error("Content not found");
}
