import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
  notInArray,
  sql,
  type SQL,
} from "drizzle-orm";
import type { Db } from "@/db/client";
import {
  authors,
  categories,
  contentAuthors,
  contentDailyStats,
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
import type { Site } from "./site";

export type ContentType = (typeof contentItems.$inferSelect)["type"];

export type MediaRef = {
  id: string;
  storageKey: string;
  alt: string;
  width: number | null;
  height: number | null;
  blurColor: string | null;
  caption: string | null;
  credit: string | null;
};

export type ContentCard = {
  id: string;
  type: ContentType;
  title: string;
  slug: string;
  standfirst: string | null;
  publishedAt: Date;
  isFeatured: boolean;
  category: { id: string; name: string; slug: string } | null;
  heroImage: MediaRef | null;
  authors: { name: string; slug: string }[];
  /** Estimated reading time in minutes (articles and news). */
  readMinutes: number;
  review: {
    score: number;
    scoreMax: number;
    badge: string | null;
    verdict: string | null;
    releaseYear: number | null;
    studio: string | null;
  } | null;
  video: { durationSeconds: number | null; studio: string | null } | null;
};

export type ContentPage = ContentCard & {
  body: RichTextDoc | null;
  updatedAt: Date;
  commentsEnabled: boolean;
  seoTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  robotsIndex: boolean;
  ogImage: MediaRef | null;
  tags: { id: string; name: string; slug: string }[];
  authorDetails: { name: string; slug: string; role: string | null }[];
};

/** Public URL segment for each content type. */
export const SECTION_FOR_TYPE: Record<ContentType, string> = {
  article: "features",
  review: "reviews",
  video: "videos",
  news: "news",
};
export const TYPE_FOR_SECTION: Record<string, ContentType> = Object.fromEntries(
  Object.entries(SECTION_FOR_TYPE).map(([t, s]) => [s, t as ContentType]),
);

export function contentPath(item: { type: ContentType; slug: string }): string {
  return `/${SECTION_FOR_TYPE[item.type]}/${item.slug}`;
}

/** The only definition of "visible to readers". */
function isLive(s: Site, now = new Date()): SQL {
  return and(
    eq(contentItems.publicationId, s.publicationId),
    eq(contentItems.status, "published"),
    isNotNull(contentItems.publishedAt),
    lte(contentItems.publishedAt, now),
  )!;
}

const cardColumns = {
  id: contentItems.id,
  type: contentItems.type,
  title: contentItems.title,
  slug: contentItems.slug,
  standfirst: contentItems.standfirst,
  publishedAt: contentItems.publishedAt,
  isFeatured: contentItems.isFeatured,
  categoryId: contentItems.categoryId,
  heroImageId: contentItems.heroImageId,
  bodyChars: sql<number>`length(${contentItems.bodyText})`.mapWith(Number),
};

type CardRow = {
  id: string;
  type: ContentType;
  title: string;
  slug: string;
  standfirst: string | null;
  publishedAt: Date | null;
  isFeatured: boolean;
  categoryId: string | null;
  heroImageId: string | null;
  bodyChars: number;
};

async function loadMedia(db: Db, s: Site, ids: (string | null)[]) {
  const wanted = [...new Set(ids.filter((x): x is string => !!x))];
  if (!wanted.length) return new Map<string, MediaRef>();
  const rows = await db
    .select({
      id: media.id,
      storageKey: media.storageKey,
      alt: media.alt,
      width: media.width,
      height: media.height,
      blurColor: media.blurColor,
      caption: media.caption,
      credit: media.credit,
    })
    .from(media)
    .where(and(eq(media.publicationId, s.publicationId), inArray(media.id, wanted)));
  return new Map(rows.map((r) => [r.id, r]));
}

/** Turns bare content rows into cards with their category, image, authors and score. */
async function hydrateCards(db: Db, s: Site, rows: CardRow[]): Promise<ContentCard[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const categoryIds = [...new Set(rows.map((r) => r.categoryId).filter((x): x is string => !!x))];

  const [mediaById, cats, authorRows, scores, videos] = await Promise.all([
    loadMedia(db, s, rows.map((r) => r.heroImageId)),
    categoryIds.length
      ? db
          .select({ id: categories.id, name: categories.name, slug: categories.slug })
          .from(categories)
          .where(and(eq(categories.publicationId, s.publicationId), inArray(categories.id, categoryIds)))
      : Promise.resolve([]),
    db
      .select({ contentId: contentAuthors.contentId, name: authors.name, slug: authors.slug })
      .from(contentAuthors)
      .innerJoin(authors, eq(authors.id, contentAuthors.authorId))
      .where(and(inArray(contentAuthors.contentId, ids), eq(authors.publicationId, s.publicationId)))
      .orderBy(contentAuthors.position),
    db
      .select({
        contentId: reviewDetails.contentId,
        score: reviewDetails.score,
        scoreMax: reviewDetails.scoreMax,
        badge: reviewDetails.badge,
        verdict: reviewDetails.verdict,
        releaseYear: reviewDetails.releaseYear,
        studio: entities.name,
      })
      .from(reviewDetails)
      .leftJoin(entities, and(eq(entities.id, reviewDetails.subjectEntityId), eq(entities.publicationId, s.publicationId)))
      .where(inArray(reviewDetails.contentId, ids)),
    db
      .select({ contentId: videoDetails.contentId, durationSeconds: videoDetails.durationSeconds, studio: entities.name })
      .from(videoDetails)
      .leftJoin(entities, and(eq(entities.id, videoDetails.studioEntityId), eq(entities.publicationId, s.publicationId)))
      .where(inArray(videoDetails.contentId, ids)),
  ]);

  const catById = new Map(cats.map((c) => [c.id, c]));
  const scoreById = new Map(scores.map((r) => [r.contentId, r]));
  const videoById = new Map(videos.map((v) => [v.contentId, v]));

  return rows.map((r) => {
    const score = scoreById.get(r.id);
    const video = videoById.get(r.id);
    return {
      id: r.id,
      type: r.type,
      title: r.title,
      slug: r.slug,
      standfirst: r.standfirst,
      publishedAt: r.publishedAt!,
      isFeatured: r.isFeatured,
      category: r.categoryId ? (catById.get(r.categoryId) ?? null) : null,
      heroImage: r.heroImageId ? (mediaById.get(r.heroImageId) ?? null) : null,
      authors: authorRows.filter((a) => a.contentId === r.id).map(({ name, slug }) => ({ name, slug })),
      // ~1,300 characters a minute is a typical adult reading speed.
      readMinutes: Math.max(1, Math.round((r.bodyChars ?? 0) / 1300)),
      review: score
        ? {
            score: Number(score.score),
            scoreMax: score.scoreMax,
            badge: score.badge,
            verdict: score.verdict,
            releaseYear: score.releaseYear,
            studio: score.studio,
          }
        : null,
      video: video ? { durationSeconds: video.durationSeconds, studio: video.studio } : null,
    };
  });
}

export type ListOptions = {
  types?: ContentType[];
  categoryId?: string;
  featuredOnly?: boolean;
  excludeIds?: string[];
  limit?: number;
  offset?: number;
};

export async function listPublished(db: Db, s: Site, opts: ListOptions = {}): Promise<ContentCard[]> {
  const where = [isLive(s)];
  if (opts.types?.length) where.push(inArray(contentItems.type, opts.types));
  if (opts.categoryId) where.push(eq(contentItems.categoryId, opts.categoryId));
  if (opts.featuredOnly) where.push(eq(contentItems.isFeatured, true));
  if (opts.excludeIds?.length) where.push(notInArray(contentItems.id, opts.excludeIds));

  const rows = await db
    .select(cardColumns)
    .from(contentItems)
    .where(and(...where))
    .orderBy(desc(contentItems.publishedAt), desc(contentItems.id))
    .limit(Math.min(opts.limit ?? 12, 50))
    .offset(opts.offset ?? 0);
  return hydrateCards(db, s, rows);
}

/** Published cards in the given order; anything not live is dropped. */
export async function getCardsByIds(db: Db, s: Site, ids: string[]): Promise<ContentCard[]> {
  if (!ids.length) return [];
  const rows = await db
    .select(cardColumns)
    .from(contentItems)
    .where(and(isLive(s), inArray(contentItems.id, ids)));
  const cards = await hydrateCards(db, s, rows);
  const byId = new Map(cards.map((c) => [c.id, c]));
  return ids.map((id) => byId.get(id)).filter((c): c is ContentCard => !!c);
}

/** Most viewed over the last `days`, topped up with recent content. */
export async function listTrending(db: Db, s: Site, limit = 6, days = 7): Promise<ContentCard[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const views = sql<number>`sum(${contentDailyStats.views})`;
  const rows = await db
    .select({ ...cardColumns, views })
    .from(contentDailyStats)
    .innerJoin(contentItems, eq(contentItems.id, contentDailyStats.contentId))
    .where(and(isLive(s), eq(contentDailyStats.publicationId, s.publicationId), gte(contentDailyStats.day, since)))
    .groupBy(contentItems.id)
    .orderBy(desc(views))
    .limit(limit);
  const cards = await hydrateCards(db, s, rows);
  if (cards.length >= limit) return cards;
  const topUp = await listPublished(db, s, { limit: limit - cards.length, excludeIds: cards.map((c) => c.id) });
  return [...cards, ...topUp];
}

export async function getPublishedBySlug(
  db: Db,
  s: Site,
  type: ContentType,
  slug: string,
): Promise<ContentPage | null> {
  const [row] = await db
    .select({
      ...cardColumns,
      body: contentItems.body,
      updatedAt: contentItems.updatedAt,
      commentsEnabled: contentItems.commentsEnabled,
      seoTitle: contentItems.seoTitle,
      metaDescription: contentItems.metaDescription,
      canonicalUrl: contentItems.canonicalUrl,
      robotsIndex: contentItems.robotsIndex,
      ogImageId: contentItems.ogImageId,
    })
    .from(contentItems)
    .where(and(isLive(s), eq(contentItems.type, type), eq(contentItems.slug, slug)))
    .limit(1);
  if (!row) return null;

  const [[card], tagRows, authorRows, ogMedia] = await Promise.all([
    hydrateCards(db, s, [row]),
    db
      .select({ id: tags.id, name: tags.name, slug: tags.slug })
      .from(contentTags)
      .innerJoin(tags, eq(tags.id, contentTags.tagId))
      .where(and(eq(contentTags.contentId, row.id), eq(tags.publicationId, s.publicationId)))
      .orderBy(tags.name),
    db
      .select({ name: authors.name, slug: authors.slug, role: authors.role })
      .from(contentAuthors)
      .innerJoin(authors, eq(authors.id, contentAuthors.authorId))
      .where(and(eq(contentAuthors.contentId, row.id), eq(authors.publicationId, s.publicationId)))
      .orderBy(contentAuthors.position),
    loadMedia(db, s, [row.ogImageId]),
  ]);

  return {
    ...card,
    body: row.body,
    updatedAt: row.updatedAt,
    commentsEnabled: row.commentsEnabled,
    seoTitle: row.seoTitle,
    metaDescription: row.metaDescription,
    canonicalUrl: row.canonicalUrl,
    robotsIndex: row.robotsIndex,
    ogImage: row.ogImageId ? (ogMedia.get(row.ogImageId) ?? null) : null,
    tags: tagRows,
    authorDetails: authorRows,
  };
}

/**
 * Related content: editor picks first, then items sharing the most tags,
 * then the same category, newest first. Never returns the item itself.
 */
export async function listRelated(db: Db, s: Site, contentId: string, limit = 4): Promise<ContentCard[]> {
  const manual = await db
    .select({ id: relatedContent.relatedId })
    .from(relatedContent)
    .where(eq(relatedContent.contentId, contentId))
    .orderBy(relatedContent.position);
  const picked = await getCardsByIds(db, s, manual.map((m) => m.id));
  if (picked.length >= limit) return picked.slice(0, limit);

  const [self] = await db
    .select({ categoryId: contentItems.categoryId })
    .from(contentItems)
    .where(and(eq(contentItems.publicationId, s.publicationId), eq(contentItems.id, contentId)));
  if (!self) return picked;

  const exclude = [contentId, ...picked.map((p) => p.id)];
  const sharedTags = sql<number>`(
    select count(*) from content_tags ct
    where ct.content_id = "content_items"."id"
      and ct.tag_id in (select tag_id from content_tags where content_id = ${contentId})
  )`;
  const sameCategory = self.categoryId
    ? sql<number>`case when ${contentItems.categoryId} = ${self.categoryId} then 1 else 0 end`
    : sql<number>`0`;

  const rows = await db
    .select(cardColumns)
    .from(contentItems)
    .where(and(isLive(s), notInArray(contentItems.id, exclude)))
    .orderBy(desc(sql`(${sharedTags}) * 2 + ${sameCategory}`), desc(contentItems.publishedAt))
    .limit(limit - picked.length);

  return [...picked, ...(await hydrateCards(db, s, rows))];
}

export async function listCategories(db: Db, s: Site) {
  const count = sql<number>`(
    select count(*)::int from content_items ci
    where ci.category_id = "categories"."id"
      and ci.status = 'published'
      and ci.published_at <= now()
  )`;
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      intro: categories.intro,
      imageId: categories.imageId,
      count,
    })
    .from(categories)
    .where(eq(categories.publicationId, s.publicationId))
    .orderBy(categories.position, categories.name);
  const mediaById = await loadMedia(db, s, rows.map((r) => r.imageId));
  return rows.map(({ imageId, ...r }) => ({ ...r, image: imageId ? (mediaById.get(imageId) ?? null) : null }));
}

/** Everything a sitemap needs; only indexable, live content. */
export async function listSitemapEntries(db: Db, s: Site) {
  return db
    .select({ type: contentItems.type, slug: contentItems.slug, updatedAt: contentItems.updatedAt })
    .from(contentItems)
    .where(and(isLive(s), eq(contentItems.robotsIndex, true), sql`${contentItems.canonicalUrl} is null`))
    .orderBy(desc(contentItems.publishedAt))
    .limit(45_000);
}

export async function getCategoryBySlug(db: Db, s: Site, slug: string) {
  const [row] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.publicationId, s.publicationId), eq(categories.slug, slug)))
    .limit(1);
  return row ?? null;
}
