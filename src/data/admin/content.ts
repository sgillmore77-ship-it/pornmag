import { and, asc, count, desc, eq, ilike, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import {
  authors,
  categories,
  contentAuthors,
  contentEntities,
  contentItems,
  contentTags,
  entities,
  media,
  relatedContent,
  reviewDetails,
  tags,
  videoDetails,
  type RichTextDoc,
} from "@/db/schema";
import { embedSrc, toEmbed } from "@/lib/embeds";
import { docToText } from "@/lib/doc-text";
import { can, ForbiddenError, type Actor } from "@/lib/permissions";
import type { Site } from "../site";

export const CONTENT_TYPES = ["article", "review", "video", "news"] as const;
export const CONTENT_STATUSES = ["draft", "scheduled", "published", "archived"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

/** Throws unless every id exists in the given table *for this publication*. */
async function assertOwned(
  db: Db,
  s: Site,
  table: typeof media | typeof categories | typeof authors | typeof contentItems | typeof tags | typeof entities,
  ids: (string | null | undefined)[],
  label: string,
) {
  const wanted = [...new Set(ids.filter((x): x is string => !!x))];
  if (!wanted.length) return;
  const rows = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.publicationId, s.publicationId), inArray(table.id, wanted)));
  if (rows.length !== wanted.length) throw new Error(`Unknown ${label}`);
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

export type AdminListFilter = {
  type?: (typeof CONTENT_TYPES)[number];
  status?: ContentStatus;
  q?: string;
  page?: number;
  /** Restrict to items this user created or is credited on (authors). */
  onlyUserId?: string;
};

export const ADMIN_PAGE_SIZE = 30;

function ownWhere(userId: string) {
  return or(
    eq(contentItems.createdBy, userId),
    sql`exists (select 1 from ${contentAuthors} ca join ${authors} a on a.id = ca.author_id where ca.content_id = ${contentItems.id} and a.user_id = ${userId})`,
  );
}

export async function listContentAdmin(db: Db, s: Site, f: AdminListFilter = {}) {
  const where = [eq(contentItems.publicationId, s.publicationId)];
  if (f.type) where.push(eq(contentItems.type, f.type));
  if (f.status) where.push(eq(contentItems.status, f.status));
  if (f.q?.trim()) where.push(ilike(contentItems.title, `%${f.q.trim().replace(/[%_]/g, "\\$&")}%`));
  if (f.onlyUserId) where.push(ownWhere(f.onlyUserId)!);
  const page = Math.max(1, f.page ?? 1);

  const rows = await db
    .select({
      id: contentItems.id,
      type: contentItems.type,
      status: contentItems.status,
      title: contentItems.title,
      slug: contentItems.slug,
      publishedAt: contentItems.publishedAt,
      scheduledFor: contentItems.scheduledFor,
      updatedAt: contentItems.updatedAt,
      category: categories.name,
      isFeatured: contentItems.isFeatured,
    })
    .from(contentItems)
    .leftJoin(categories, eq(categories.id, contentItems.categoryId))
    .where(and(...where))
    .orderBy(desc(contentItems.updatedAt))
    .limit(ADMIN_PAGE_SIZE + 1)
    .offset((page - 1) * ADMIN_PAGE_SIZE);

  const ids = rows.map((r) => r.id);
  const byline = ids.length
    ? await db
        .select({ contentId: contentAuthors.contentId, name: authors.name })
        .from(contentAuthors)
        .innerJoin(authors, eq(authors.id, contentAuthors.authorId))
        .where(inArray(contentAuthors.contentId, ids))
        .orderBy(asc(contentAuthors.position))
    : [];

  return {
    items: rows.slice(0, ADMIN_PAGE_SIZE).map((r) => ({ ...r, authors: byline.filter((b) => b.contentId === r.id).map((b) => b.name) })),
    hasNext: rows.length > ADMIN_PAGE_SIZE,
    page,
  };
}

export async function contentCounts(db: Db, s: Site) {
  const rows = await db
    .select({ status: contentItems.status, n: count() })
    .from(contentItems)
    .where(eq(contentItems.publicationId, s.publicationId))
    .groupBy(contentItems.status);
  const out: Record<ContentStatus, number> = { draft: 0, scheduled: 0, published: 0, archived: 0 };
  for (const r of rows) out[r.status] = r.n;
  return out;
}

export async function upcomingScheduled(db: Db, s: Site, limit = 5) {
  return db
    .select({ id: contentItems.id, title: contentItems.title, scheduledFor: contentItems.scheduledFor })
    .from(contentItems)
    .where(and(eq(contentItems.publicationId, s.publicationId), eq(contentItems.status, "scheduled")))
    .orderBy(asc(contentItems.scheduledFor))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

export async function getContentForEdit(db: Db, s: Site, id: string) {
  const [item] = await db
    .select()
    .from(contentItems)
    .where(and(eq(contentItems.publicationId, s.publicationId), eq(contentItems.id, id)))
    .limit(1);
  if (!item) return null;
  const [authorRows, tagRows, relatedRows, [review], [video]] = await Promise.all([
    db.select({ id: contentAuthors.authorId }).from(contentAuthors).where(eq(contentAuthors.contentId, id)).orderBy(asc(contentAuthors.position)),
    db.select({ name: tags.name }).from(contentTags).innerJoin(tags, eq(tags.id, contentTags.tagId)).where(eq(contentTags.contentId, id)).orderBy(asc(tags.name)),
    db
      .select({ id: relatedContent.relatedId, title: contentItems.title })
      .from(relatedContent)
      .innerJoin(contentItems, eq(contentItems.id, relatedContent.relatedId))
      .where(eq(relatedContent.contentId, id))
      .orderBy(asc(relatedContent.position)),
    db.select().from(reviewDetails).where(eq(reviewDetails.contentId, id)),
    db.select().from(videoDetails).where(eq(videoDetails.contentId, id)),
  ]);
  return {
    ...item,
    authorIds: authorRows.map((a) => a.id),
    tagNames: tagRows.map((t) => t.name),
    related: relatedRows,
    review: review ? { ...review, score: Number(review.score) } : null,
    video: video ?? null,
  };
}

/** May this actor edit this item? Authors may only edit their own, and never published work. */
export async function canEditItem(db: Db, s: Site, actor: Actor, id: string): Promise<boolean> {
  // The item must belong to this publication, whoever is asking.
  const [exists] = await db
    .select({ id: contentItems.id })
    .from(contentItems)
    .where(and(eq(contentItems.publicationId, s.publicationId), eq(contentItems.id, id)))
    .limit(1);
  if (!exists) return false;
  if (can(actor, "content.edit.any")) return true;
  if (!can(actor, "content.edit.own")) return false;
  const [row] = await db
    .select({ id: contentItems.id, status: contentItems.status })
    .from(contentItems)
    .where(and(eq(contentItems.publicationId, s.publicationId), eq(contentItems.id, id), ownWhere(actor.userId)!))
    .limit(1);
  return !!row && (row.status === "draft" || row.status === "archived");
}

const nodeSchema: z.ZodType = z.lazy(() =>
  z.object({
    type: z.string().max(40),
    attrs: z.record(z.string(), z.unknown()).optional(),
    content: z.array(nodeSchema).max(5000).optional(),
    text: z.string().max(100_000).optional(),
    marks: z.array(z.object({ type: z.string().max(40), attrs: z.record(z.string(), z.unknown()).optional() })).max(20).optional(),
  }),
);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const optionalId = z
  .string()
  .max(64)
  .optional()
  .transform((v) => (v ? v : null));

export const contentInput = z.object({
  id: optionalId,
  type: z.enum(CONTENT_TYPES),
  title: z.string().trim().min(1, "is required").max(200),
  slug: z.string().trim().max(90).optional(),
  standfirst: optionalText(600),
  body: z.object({ type: z.literal("doc"), content: z.array(nodeSchema).max(5000).optional() }),
  status: z.enum(CONTENT_STATUSES),
  scheduledFor: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : null))
    .refine((d) => d === null || !Number.isNaN(d.getTime()), "is not a valid date"),
  categoryId: optionalId,
  heroImageId: optionalId,
  ogImageId: optionalId,
  authorIds: z.array(z.string().max(64)).max(10).default([]),
  tagNames: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  relatedIds: z.array(z.string().max(64)).max(12).default([]),
  isFeatured: z.boolean().default(false),
  commentsEnabled: z.boolean().default(true),
  seoTitle: optionalText(120),
  metaDescription: optionalText(320),
  canonicalUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^https?:\/\//.test(v), "must start with http:// or https://"),
  robotsIndex: z.boolean().default(true),
  review: z
    .object({
      score: z.coerce
        .number()
        .min(0)
        .max(5)
        .refine((n) => Number.isInteger(n * 2), "must be in half steps (e.g. 3.5)"),
      badge: optionalText(40),
      verdict: optionalText(400),
      pros: z.array(z.string().trim().max(200)).max(10).default([]).transform((xs) => xs.filter(Boolean)),
      cons: z.array(z.string().trim().max(200)).max(10).default([]).transform((xs) => xs.filter(Boolean)),
      subjectEntityId: optionalId,
      releaseYear: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
      pricing: optionalText(120),
      affiliateUrl: z
        .string()
        .trim()
        .max(1000)
        .optional()
        .transform((v) => (v ? v : null))
        .refine((v) => v === null || /^https:\/\//.test(v), "must start with https://"),
    })
    .optional(),
  video: z
    .object({
      url: z.string().trim().max(500).optional().default(""),
      durationSeconds: z.coerce.number().int().min(0).max(86_400).optional().nullable(),
      studioEntityId: optionalId,
      /** Optional rating for the video, out of 5. */
      score: z.coerce
        .number()
        .min(0)
        .max(5)
        .refine((n) => Number.isInteger(n * 2), "must be in half steps")
        .optional()
        .nullable(),
    })
    .optional(),
});

export type ContentInput = z.input<typeof contentInput>;

export async function saveContent(db: Db, s: Site, actor: Actor, raw: ContentInput, now = new Date()) {
  const input = contentInput.parse(raw);
  if (JSON.stringify(input.body).length > 1_000_000) throw new Error("Body is too large");

  const isNew = !input.id;
  if (isNew && !can(actor, "content.create")) throw new ForbiddenError("content.create");
  if (!isNew && !(await canEditItem(db, s, actor, input.id!))) throw new ForbiddenError("content.edit.own");

  // Workflow: only editors and admins can publish or schedule.
  if ((input.status === "published" || input.status === "scheduled") && !can(actor, "content.publish")) {
    throw new ForbiddenError("content.publish");
  }
  if (input.status === "scheduled") {
    if (!input.scheduledFor) throw new Error("Scheduled for: choose a date and time");
    if (input.scheduledFor <= now) throw new Error("Scheduled for: must be in the future");
  }

  if (input.type === "review" && !input.review) throw new Error("Review: add a score");
  // Videos must point at an approved provider before they can go live.
  const embed = input.type === "video" && input.video?.url ? toEmbed(input.video.url) : null;
  if (input.type === "video" && input.video?.url && !embed) throw new Error("Video: that link isn't from an approved video provider");
  if (input.type === "video" && (input.status === "published" || input.status === "scheduled") && !embed) {
    throw new Error("Video: add the video link before publishing");
  }
  if (embed && !embedSrc(embed.provider, embed.url)) throw new Error("Video: unsupported embed");

  await Promise.all([
    assertOwned(db, s, entities, [input.review?.subjectEntityId, input.video?.studioEntityId], "studio or creator"),
    assertOwned(db, s, categories, [input.categoryId], "category"),
    assertOwned(db, s, media, [input.heroImageId, input.ogImageId], "image"),
    assertOwned(db, s, authors, input.authorIds, "author"),
    assertOwned(db, s, contentItems, input.relatedIds, "related item"),
  ]);

  const slug = slugify(input.slug || input.title) || `untitled-${Date.now()}`;
  const existing = isNew
    ? null
    : (
        await db
          .select({ status: contentItems.status, publishedAt: contentItems.publishedAt })
          .from(contentItems)
          .where(and(eq(contentItems.publicationId, s.publicationId), eq(contentItems.id, input.id!)))
      )[0];

  // First publication sets the date; republishing keeps it.
  let publishedAt: Date | null = existing?.publishedAt ?? null;
  if (input.status === "published" && !publishedAt) publishedAt = now;
  if (input.status === "scheduled") publishedAt = null;

  const values = {
    publicationId: s.publicationId,
    type: input.type,
    status: input.status,
    title: input.title,
    slug,
    standfirst: input.standfirst,
    body: input.body as RichTextDoc,
    bodyText: docToText(input.body as RichTextDoc),
    heroImageId: input.heroImageId,
    ogImageId: input.ogImageId,
    categoryId: input.categoryId,
    isFeatured: input.isFeatured,
    commentsEnabled: input.commentsEnabled,
    scheduledFor: input.status === "scheduled" ? input.scheduledFor : null,
    publishedAt,
    seoTitle: input.seoTitle,
    metaDescription: input.metaDescription,
    canonicalUrl: input.canonicalUrl,
    robotsIndex: input.robotsIndex,
  };

  return db.transaction(async (tx) => {
    let id = input.id;
    if (isNew) {
      const [row] = await tx.insert(contentItems).values({ ...values, createdBy: actor.userId }).returning({ id: contentItems.id });
      id = row.id;
    } else {
      const updated = await tx
        .update(contentItems)
        .set(values)
        .where(and(eq(contentItems.publicationId, s.publicationId), eq(contentItems.id, id!)))
        .returning({ id: contentItems.id });
      // Belt and braces: never touch links for an item outside this publication.
      if (updated.length !== 1) throw new Error("Not found");
    }

    await tx.delete(contentAuthors).where(eq(contentAuthors.contentId, id!));
    if (input.authorIds.length) {
      await tx.insert(contentAuthors).values([...new Set(input.authorIds)].map((authorId, position) => ({ contentId: id!, authorId, position })));
    }

    await tx.delete(contentTags).where(eq(contentTags.contentId, id!));
    const tagNames = [...new Map(input.tagNames.map((n) => [slugify(n), n])).entries()].filter(([slug]) => slug);
    if (tagNames.length) {
      await tx
        .insert(tags)
        .values(tagNames.map(([slug, name]) => ({ publicationId: s.publicationId, name, slug })))
        .onConflictDoNothing();
      const tagRows = await tx
        .select({ id: tags.id })
        .from(tags)
        .where(and(eq(tags.publicationId, s.publicationId), inArray(tags.slug, tagNames.map(([slug]) => slug))));
      await tx.insert(contentTags).values(tagRows.map((t) => ({ contentId: id!, tagId: t.id })));
    }

    await tx.delete(relatedContent).where(eq(relatedContent.contentId, id!));
    const related = [...new Set(input.relatedIds)].filter((r) => r !== id);
    if (related.length) {
      await tx.insert(relatedContent).values(related.map((relatedId, position) => ({ contentId: id!, relatedId, position })));
    }

    // Type-specific details. Changing type removes details that no longer apply.
    const rating =
      input.type === "review" && input.review
        ? input.review
        : input.type === "video" && input.video?.score != null
          ? { score: input.video.score, badge: null, verdict: null, pros: [], cons: [], subjectEntityId: null, releaseYear: null, pricing: null, affiliateUrl: null }
          : null;
    await tx.delete(reviewDetails).where(eq(reviewDetails.contentId, id!));
    if (rating) {
      await tx.insert(reviewDetails).values({
        contentId: id!,
        score: rating.score.toFixed(1),
        scoreMax: 5,
        badge: rating.badge,
        verdict: rating.verdict,
        pros: rating.pros,
        cons: rating.cons,
        subjectEntityId: rating.subjectEntityId,
        releaseYear: rating.releaseYear ?? null,
        pricing: rating.pricing,
        affiliateUrl: rating.affiliateUrl,
        reviewedAt: (publishedAt ?? now).toISOString().slice(0, 10),
      });
    }
    await tx.delete(videoDetails).where(eq(videoDetails.contentId, id!));
    if (input.type === "video") {
      await tx.insert(videoDetails).values({
        contentId: id!,
        provider: embed?.provider ?? "pending",
        embedUrl: embed?.url ?? "",
        durationSeconds: input.video?.durationSeconds ?? null,
        studioEntityId: input.video?.studioEntityId ?? null,
      });
    }

    // Entities power "related content": link whoever this piece covers.
    await tx.delete(contentEntities).where(eq(contentEntities.contentId, id!));
    const linked = [...new Set([rating?.subjectEntityId, input.type === "video" ? input.video?.studioEntityId : null].filter((x): x is string => !!x))];
    if (linked.length) await tx.insert(contentEntities).values(linked.map((entityId) => ({ contentId: id!, entityId })));

    return { id: id!, slug, status: input.status, wasLive: existing?.status === "published", isNew };
  });
}

export async function deleteContent(db: Db, s: Site, actor: Actor, id: string) {
  if (!can(actor, "content.edit.any")) throw new ForbiddenError("content.edit.any");
  const deleted = await db
    .delete(contentItems)
    .where(and(eq(contentItems.publicationId, s.publicationId), eq(contentItems.id, id)))
    .returning({ id: contentItems.id, title: contentItems.title });
  if (!deleted.length) throw new Error("Not found");
  return deleted[0];
}

/**
 * Publishes every scheduled item whose time has come, across all
 * publications. Returns which publications changed so their caches can be
 * refreshed. Run every few minutes by the scheduler.
 */
export async function publishDue(db: Db, now = new Date()) {
  return db
    .update(contentItems)
    .set({ status: "published", publishedAt: sql`${contentItems.scheduledFor}`, scheduledFor: null })
    .where(and(eq(contentItems.status, "scheduled"), isNotNull(contentItems.scheduledFor), lte(contentItems.scheduledFor, now)))
    .returning({ id: contentItems.id, publicationId: contentItems.publicationId, title: contentItems.title });
}
