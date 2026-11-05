import { and, asc, count, desc, eq, gt, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { commentReports, comments, contentItems, contentReports, favourites, memberships, publications, users } from "@/db/schema";
import { can, type Actor } from "@/lib/permissions";
import { contentPath, getCardsByIds, isLive, type ContentCard } from "./content";
import type { Site } from "./site";

/**
 * Reader community: comments, public profiles, saved stories and reports.
 * Every function takes the publication (`Site`) and filters on it.
 */

export class CommunityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommunityError";
  }
}

export type Reader = { userId: string; actor: Actor };

/** Staff comments skip the queue and are labelled. */
const isStaff = (a: Actor) => can(a, "comments.moderate") || can(a, "content.create");

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

export const HANDLE_RE = /^[a-z0-9_]{3,24}$/;
const RESERVED = new Set([
  "admin", "administrator", "moderator", "mod", "staff", "editor", "editors", "support", "help", "official",
  "root", "system", "null", "undefined", "anonymous", "deleted", "removed", "account", "login", "search",
]);

export const profileInput = z.object({
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .regex(HANDLE_RE, "Use 3–24 lowercase letters, numbers or underscores")
    .refine((h) => !RESERVED.has(h), "That name is reserved"),
  displayName: z.string().trim().max(50).optional().transform((v) => v || null),
  bio: z.string().trim().max(280).optional().transform((v) => v || null),
});

export type Profile = {
  userId: string;
  handle: string | null;
  displayName: string | null;
  bio: string | null;
  role: Actor["role"];
  joinedAt: Date;
  commentsBlocked: boolean;
};

/** A reader's membership row; created on first use if they signed up on another site. */
export async function ensureMembership(db: Db, s: Site, userId: string): Promise<Profile> {
  await db.insert(memberships).values({ publicationId: s.publicationId, userId, role: "user" }).onConflictDoNothing();
  const [m] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.publicationId, s.publicationId), eq(memberships.userId, userId)));
  return {
    userId,
    handle: m.handle,
    displayName: m.displayName,
    bio: m.bio,
    role: m.role,
    joinedAt: m.createdAt,
    commentsBlocked: !!m.commentsBlockedAt,
  };
}

export async function updateProfile(db: Db, s: Site, userId: string, raw: unknown): Promise<void> {
  const input = profileInput.parse(raw);
  await ensureMembership(db, s, userId);
  const [taken] = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(and(eq(memberships.publicationId, s.publicationId), sql`lower(${memberships.handle}) = ${input.handle}`, ne(memberships.userId, userId)));
  if (taken) throw new CommunityError("That name is taken. Try another.");
  await db
    .update(memberships)
    .set({ handle: input.handle, displayName: input.displayName, bio: input.bio })
    .where(and(eq(memberships.publicationId, s.publicationId), eq(memberships.userId, userId)));
}

export type PublicProfile = {
  handle: string;
  name: string;
  bio: string | null;
  joinedAt: Date;
  staff: boolean;
  commentCount: number;
  recent: { id: string; body: string; createdAt: Date; title: string; path: string }[];
};

export async function getPublicProfile(db: Db, s: Site, handle: string): Promise<PublicProfile | null> {
  const [m] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.publicationId, s.publicationId), sql`lower(${memberships.handle}) = ${handle.toLowerCase()}`));
  if (!m?.handle) return null;
  const visible = and(eq(comments.publicationId, s.publicationId), eq(comments.userId, m.userId), eq(comments.status, "approved"), isLive(s));
  const [[{ n }], recent] = await Promise.all([
    db.select({ n: count() }).from(comments).innerJoin(contentItems, eq(contentItems.id, comments.contentId)).where(visible),
    db
      .select({ id: comments.id, body: comments.body, createdAt: comments.createdAt, title: contentItems.title, type: contentItems.type, slug: contentItems.slug })
      .from(comments)
      .innerJoin(contentItems, eq(contentItems.id, comments.contentId))
      .where(visible)
      .orderBy(desc(comments.createdAt))
      .limit(20),
  ]);
  return {
    handle: m.handle,
    name: m.displayName ?? m.handle,
    bio: m.bio,
    joinedAt: m.createdAt,
    staff: m.role !== "user",
    commentCount: n,
    recent: recent.map((r) => ({ id: r.id, body: r.body, createdAt: r.createdAt, title: r.title, path: `${contentPath(r)}#comment-${r.id}` })),
  };
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export const COMMENT_MAX = 2000;
export const EDIT_WINDOW_MS = 15 * 60_000;
const RATE = { windowMs: 10 * 60_000, max: 5, gapMs: 15_000 };
/** Distinct open reports that send an approved comment back to the queue. */
export const REPORT_THRESHOLD = 3;

export const COMMENT_REPORT_REASONS = {
  spam: "Spam or advertising",
  harassment: "Harassment or abuse",
  hate: "Hate speech",
  personal_info: "Shares someone's personal information",
  minor: "Involves or sexualises a minor",
  other: "Something else",
} as const;

function cleanBody(raw: unknown): string {
  const body = String(raw ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (body.length < 2) throw new CommunityError("Write a little more.");
  if (body.length > COMMENT_MAX) throw new CommunityError(`Keep it under ${COMMENT_MAX} characters.`);
  return body;
}

const linkCount = (body: string) => (body.match(/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|xxx|ly|me)\b/gi) ?? []).length;

export type CommentView = {
  id: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  edited: boolean;
  status: "approved" | "pending" | "removed";
  author: { handle: string | null; name: string; staff: boolean } | null;
  mine: boolean;
  canEdit: boolean;
  replies: CommentView[];
};

export type ThreadState = {
  open: boolean;
  closedReason: string | null;
  count: number;
  comments: CommentView[];
  viewer: null | {
    signedIn: true;
    handle: string | null;
    blocked: boolean;
    canModerate: boolean;
    saved: boolean;
  };
};

async function liveItem(db: Db, s: Site, contentId: string) {
  const [item] = await db
    .select({ id: contentItems.id, commentsEnabled: contentItems.commentsEnabled, type: contentItems.type, slug: contentItems.slug, title: contentItems.title })
    .from(contentItems)
    .where(and(isLive(s), eq(contentItems.id, contentId)));
  return item ?? null;
}

async function commentsOpen(db: Db, s: Site, item: { commentsEnabled: boolean }) {
  const [pub] = await db.select({ settings: publications.settings }).from(publications).where(eq(publications.id, s.publicationId));
  if (pub.settings.commentModeration === "off") return { open: false, reason: "Comments are switched off on this site." };
  if (!item.commentsEnabled) return { open: false, reason: "Comments are closed on this story." };
  return { open: true, reason: null, mode: pub.settings.commentModeration ?? "first" };
}

/**
 * Everything the comment section needs: approved comments (plus the viewer's
 * own pending ones), threaded one level deep, newest conversations first.
 * Removed comments only appear as a placeholder when replies hang off them.
 */
export async function getThread(db: Db, s: Site, contentId: string, reader: Reader | null): Promise<ThreadState | null> {
  const item = await liveItem(db, s, contentId);
  if (!item) return null;
  const state = await commentsOpen(db, s, item);
  const viewerId = reader?.userId ?? "";

  const rows = await db
    .select({
      id: comments.id,
      parentId: comments.parentId,
      body: comments.body,
      status: comments.status,
      userId: comments.userId,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      handle: memberships.handle,
      displayName: memberships.displayName,
      role: memberships.role,
    })
    .from(comments)
    .leftJoin(memberships, and(eq(memberships.publicationId, comments.publicationId), eq(memberships.userId, comments.userId)))
    .where(
      and(
        eq(comments.publicationId, s.publicationId),
        eq(comments.contentId, contentId),
        or(eq(comments.status, "approved"), and(eq(comments.status, "pending"), eq(comments.userId, viewerId)), and(isNull(comments.parentId), inArray(comments.status, ["removed", "rejected", "spam"]))),
      ),
    )
    .orderBy(asc(comments.createdAt))
    .limit(1000);

  const now = Date.now();
  const views = new Map<string, CommentView>();
  for (const r of rows) {
    const hidden = r.status !== "approved" && r.status !== "pending";
    const mine = !!viewerId && r.userId === viewerId;
    views.set(r.id, {
      id: r.id,
      parentId: r.parentId,
      body: hidden ? "" : r.body,
      createdAt: r.createdAt.toISOString(),
      edited: r.updatedAt.getTime() - r.createdAt.getTime() > 5_000,
      status: hidden ? "removed" : (r.status as "approved" | "pending"),
      author: hidden ? null : { handle: r.handle, name: r.displayName ?? r.handle ?? "Reader", staff: !!r.role && r.role !== "user" },
      mine: mine && !hidden,
      canEdit: mine && !hidden && now - r.createdAt.getTime() < EDIT_WINDOW_MS,
      replies: [],
    });
  }
  const top: CommentView[] = [];
  for (const v of views.values()) {
    if (v.parentId) views.get(v.parentId)?.replies.push(v);
    else top.push(v);
  }
  const list = top.filter((c) => c.status !== "removed" || c.replies.length > 0).reverse();
  const countVisible = rows.filter((r) => r.status === "approved").length;

  let viewer: ThreadState["viewer"] = null;
  if (reader) {
    const [m] = await db
      .select({ handle: memberships.handle, blocked: memberships.commentsBlockedAt })
      .from(memberships)
      .where(and(eq(memberships.publicationId, s.publicationId), eq(memberships.userId, reader.userId)));
    const [fav] = await db
      .select({ c: favourites.contentId })
      .from(favourites)
      .where(and(eq(favourites.publicationId, s.publicationId), eq(favourites.userId, reader.userId), eq(favourites.contentId, contentId)));
    viewer = { signedIn: true, handle: m?.handle ?? null, blocked: !!m?.blocked, canModerate: can(reader.actor, "comments.moderate"), saved: !!fav };
  }
  return { open: state.open, closedReason: state.reason, count: countVisible, comments: list, viewer };
}

export const commentInput = z.object({
  contentId: z.string().min(1).max(64),
  parentId: z.string().min(1).max(64).nullish(),
  body: z.string().max(COMMENT_MAX * 2),
});

export async function postComment(
  db: Db,
  s: Site,
  reader: Reader,
  raw: unknown,
  ipHash: string | null,
): Promise<{ id: string; status: "approved" | "pending" }> {
  const input = commentInput.parse(raw);
  const body = cleanBody(input.body);
  const item = await liveItem(db, s, input.contentId);
  if (!item) throw new CommunityError("That story isn't available.");
  const state = await commentsOpen(db, s, item);
  if (!state.open) throw new CommunityError(state.reason!);

  const profile = await ensureMembership(db, s, reader.userId);
  if (profile.commentsBlocked) throw new CommunityError("Your account can't comment on this site.");
  if (!profile.handle) throw new CommunityError("Choose a public name before commenting.");

  // Replies attach to the top-level comment, keeping threads one level deep.
  let parentId: string | null = null;
  if (input.parentId) {
    const [parent] = await db
      .select({ id: comments.id, parentId: comments.parentId, status: comments.status })
      .from(comments)
      .where(and(eq(comments.publicationId, s.publicationId), eq(comments.contentId, item.id), eq(comments.id, input.parentId)));
    if (!parent || parent.status !== "approved") throw new CommunityError("You can't reply to that comment.");
    parentId = parent.parentId ?? parent.id;
  }

  const staff = isStaff(reader.actor);
  if (!staff) {
    const since = new Date(Date.now() - RATE.windowMs);
    const recent = await db
      .select({ body: comments.body, createdAt: comments.createdAt })
      .from(comments)
      .where(and(eq(comments.publicationId, s.publicationId), eq(comments.userId, reader.userId), gt(comments.createdAt, new Date(Date.now() - 24 * 3600_000))))
      .orderBy(desc(comments.createdAt));
    if (recent[0] && Date.now() - recent[0].createdAt.getTime() < RATE.gapMs) throw new CommunityError("Slow down a little before posting again.");
    if (recent.filter((r) => r.createdAt > since).length >= RATE.max) throw new CommunityError("You've posted a lot in the last few minutes. Try again shortly.");
    if (recent.some((r) => r.body === body)) throw new CommunityError("You've already posted that.");
  }

  let status: "approved" | "pending" = "approved";
  if (!staff) {
    if (state.mode === "all" || linkCount(body) > 2) status = "pending";
    else if (state.mode === "first") {
      const [{ n }] = await db
        .select({ n: count() })
        .from(comments)
        .where(and(eq(comments.publicationId, s.publicationId), eq(comments.userId, reader.userId), eq(comments.status, "approved")));
      if (n === 0) status = "pending";
    }
  }

  const [row] = await db
    .insert(comments)
    .values({ publicationId: s.publicationId, contentId: item.id, userId: reader.userId, parentId, body, status, ipHash })
    .returning({ id: comments.id });
  return { id: row.id, status };
}

async function ownComment(db: Db, s: Site, reader: Reader, commentId: string) {
  const [c] = await db
    .select()
    .from(comments)
    .where(and(eq(comments.publicationId, s.publicationId), eq(comments.id, commentId), eq(comments.userId, reader.userId)));
  if (!c || (c.status !== "approved" && c.status !== "pending")) throw new CommunityError("Comment not found.");
  return c;
}

export async function editComment(db: Db, s: Site, reader: Reader, commentId: string, rawBody: unknown) {
  const c = await ownComment(db, s, reader, commentId);
  if (Date.now() - c.createdAt.getTime() > EDIT_WINDOW_MS) throw new CommunityError("Comments can only be edited for 15 minutes.");
  const body = cleanBody(rawBody);
  const status = c.status === "approved" && linkCount(body) > 2 && !isStaff(reader.actor) ? "pending" : c.status;
  await db.update(comments).set({ body, status }).where(eq(comments.id, c.id));
}

/** Readers delete their own words; a placeholder stays only if others replied. */
export async function deleteOwnComment(db: Db, s: Site, reader: Reader, commentId: string) {
  const c = await ownComment(db, s, reader, commentId);
  await db.update(comments).set({ status: "removed", body: "", moderatedBy: reader.userId, moderatedAt: new Date() }).where(eq(comments.id, c.id));
}

export async function reportComment(db: Db, s: Site, reader: Reader, commentId: string, reason: string) {
  if (!(reason in COMMENT_REPORT_REASONS)) throw new CommunityError("Choose a reason.");
  const [c] = await db
    .select({ id: comments.id, userId: comments.userId, status: comments.status })
    .from(comments)
    .where(and(eq(comments.publicationId, s.publicationId), eq(comments.id, commentId)));
  if (!c || c.status !== "approved") throw new CommunityError("Comment not found.");
  if (c.userId === reader.userId) throw new CommunityError("You can't report your own comment.");
  await db.insert(commentReports).values({ publicationId: s.publicationId, commentId, reporterId: reader.userId, reason }).onConflictDoNothing();

  // Serious reports and enough independent reports hide it until reviewed.
  const [{ n }] = await db
    .select({ n: count() })
    .from(commentReports)
    .where(and(eq(commentReports.commentId, commentId), isNull(commentReports.resolvedAt)));
  if (reason === "minor" || n >= REPORT_THRESHOLD) {
    await db.update(comments).set({ status: "pending" }).where(and(eq(comments.id, commentId), eq(comments.status, "approved")));
  }
}

// ---------------------------------------------------------------------------
// Saved stories
// ---------------------------------------------------------------------------

export async function toggleFavourite(db: Db, s: Site, reader: Reader, contentId: string): Promise<boolean> {
  if (!(await liveItem(db, s, contentId))) throw new CommunityError("That story isn't available.");
  await ensureMembership(db, s, reader.userId);
  const where = and(eq(favourites.publicationId, s.publicationId), eq(favourites.userId, reader.userId), eq(favourites.contentId, contentId));
  const removed = await db.delete(favourites).where(where).returning();
  if (removed.length) return false;
  await db.insert(favourites).values({ publicationId: s.publicationId, userId: reader.userId, contentId }).onConflictDoNothing();
  return true;
}

export async function listFavourites(db: Db, s: Site, userId: string, limit = 60): Promise<ContentCard[]> {
  const rows = await db
    .select({ id: favourites.contentId })
    .from(favourites)
    .where(and(eq(favourites.publicationId, s.publicationId), eq(favourites.userId, userId)))
    .orderBy(desc(favourites.createdAt))
    .limit(limit);
  return getCardsByIds(db, s, rows.map((r) => r.id));
}

export async function listOwnComments(db: Db, s: Site, userId: string, limit = 30) {
  const rows = await db
    .select({ id: comments.id, body: comments.body, status: comments.status, createdAt: comments.createdAt, title: contentItems.title, type: contentItems.type, slug: contentItems.slug })
    .from(comments)
    .innerJoin(contentItems, eq(contentItems.id, comments.contentId))
    .where(and(eq(comments.publicationId, s.publicationId), eq(comments.userId, userId), inArray(comments.status, ["approved", "pending"])))
    .orderBy(desc(comments.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, path: `${contentPath(r)}#comment-${r.id}` }));
}

// ---------------------------------------------------------------------------
// Content reports (takedown, consent and legal concerns)
// ---------------------------------------------------------------------------

export const CONTENT_REPORT_REASONS = {
  consent: "I appear in this without my consent",
  underage: "Someone in this may be under 18",
  copyright: "Copyright or trademark",
  illegal: "Other illegal content",
  inaccurate: "Factual error",
  other: "Something else",
} as const;

export const contentReportInput = z.object({
  contentId: z.string().min(1).max(64),
  reason: z.enum(Object.keys(CONTENT_REPORT_REASONS) as [keyof typeof CONTENT_REPORT_REASONS]),
  details: z.string().trim().max(4000).optional().transform((v) => v || null),
  email: z
    .string()
    .trim()
    .max(254)
    .optional()
    .transform((v) => v || null)
    .refine((v) => !v || z.email().safeParse(v).success, "Enter a valid email address"),
});

export async function reportContent(db: Db, s: Site, reporterId: string | null, raw: unknown, ipHash: string | null) {
  const input = contentReportInput.parse(raw);
  if (!(await liveItem(db, s, input.contentId))) throw new CommunityError("That page isn't available.");
  if (!reporterId && !input.email) throw new CommunityError("Add an email address so we can reply.");
  // Light flood protection by account, or by hashed IP for signed-out reporters.
  const since = new Date(Date.now() - 3600_000);
  const [{ recent }] = await db
    .select({ recent: count() })
    .from(contentReports)
    .where(
      and(
        eq(contentReports.publicationId, s.publicationId),
        gt(contentReports.createdAt, since),
        reporterId ? eq(contentReports.reporterId, reporterId) : ipHash ? eq(contentReports.ipHash, ipHash) : eq(contentReports.reporterEmail, input.email ?? ""),
      ),
    );
  if (recent >= 10) throw new CommunityError("You've sent a lot of reports in the last hour. Email us directly instead.");
  await db.insert(contentReports).values({
    publicationId: s.publicationId,
    contentId: input.contentId,
    reporterId,
    reporterEmail: input.email ?? (reporterId ? (await db.select({ e: users.email }).from(users).where(eq(users.id, reporterId)))[0]?.e : null),
    reason: input.reason,
    details: input.details,
    ipHash,
  });
}
