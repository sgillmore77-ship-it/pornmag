import { and, count, desc, eq, gte, inArray, sql, sum } from "drizzle-orm";
import type { Db } from "@/db/client";
import { adDailyStats, adPlacements, comments, contentDailyStats, contentItems, trafficDailyStats } from "@/db/schema";
import { contentPath, isLive, TYPE_FOR_SECTION } from "./content";
import type { Site } from "./site";

/**
 * First-party, cookie-free page view counts. Nothing personal is stored:
 * just a count per story per day, and per traffic source per day.
 */

export const SOURCES = ["direct", "internal", "search", "social", "referral"] as const;
export type Source = (typeof SOURCES)[number];

const SEARCH = /(^|\.)(google|bing|duckduckgo|yahoo|yandex|baidu|ecosia|qwant|startpage|brave)\./i;
const SOCIAL = /(^|\.)(t\.co|x\.com|twitter\.com|reddit\.com|facebook\.com|fb\.com|instagram\.com|bsky\.app|threads\.net|tiktok\.com|t\.me|telegram\.org|discord\.com|whatsapp\.com|linkedin\.com|lnkd\.in|youtube\.com|tumblr\.com)$/i;

/** Where a view came from, from the referrer's host only. */
export function classifySource(referrer: string | null | undefined, ownHost: string, internal: boolean): Source {
  if (internal) return "internal";
  if (!referrer) return "direct";
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return "direct";
  }
  if (host === ownHost.split(":")[0].toLowerCase()) return "internal";
  if (SEARCH.test(host)) return "search";
  if (SOCIAL.test(host)) return "social";
  return "referral";
}

/** Crawlers, previews and monitoring tools shouldn't count as readers. */
export function isBot(ua: string | null): boolean {
  if (!ua || ua.length < 20) return true;
  return /bot|crawl|spider|slurp|preview|fetch|monitor|lighthouse|headless|curl|wget|python|httpclient|java\/|go-http|axios|node-fetch|facebookexternalhit|embedly|whatsapp|discord|telegram/i.test(ua);
}

/** The live story a path points at, if any. */
export async function contentIdForPath(db: Db, s: Site, path: string): Promise<string | null> {
  const m = /^\/([a-z]+)\/([^/?#]+)\/?$/.exec(path);
  if (!m) return null;
  const type = TYPE_FOR_SECTION[m[1]];
  if (!type) return null;
  let slug: string;
  try {
    slug = decodeURIComponent(m[2]);
  } catch {
    return null;
  }
  const [row] = await db
    .select({ id: contentItems.id })
    .from(contentItems)
    .where(and(isLive(s), eq(contentItems.type, type), eq(contentItems.slug, slug)));
  return row?.id ?? null;
}

export async function recordView(db: Db, s: Site, v: { path: string; source: Source; day: string }) {
  if (!v.path.startsWith("/") || v.path.length > 300 || /^\/(admin|api|account|login|register|forgot-password|reset-password)(\/|$)/.test(v.path)) return false;
  await db
    .insert(trafficDailyStats)
    .values({ publicationId: s.publicationId, day: v.day, source: v.source, views: 1 })
    .onConflictDoUpdate({
      target: [trafficDailyStats.publicationId, trafficDailyStats.day, trafficDailyStats.source],
      set: { views: sql`${trafficDailyStats.views} + 1` },
    });
  const contentId = await contentIdForPath(db, s, v.path);
  if (contentId) {
    await db
      .insert(contentDailyStats)
      .values({ publicationId: s.publicationId, contentId, day: v.day, views: 1 })
      .onConflictDoUpdate({ target: [contentDailyStats.contentId, contentDailyStats.day], set: { views: sql`${contentDailyStats.views} + 1` } });
  }
  return true;
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export type AnalyticsReport = {
  days: { day: string; views: number; storyViews: number }[];
  total: number;
  storyViews: number;
  previousTotal: number;
  sources: { source: Source; views: number }[];
  top: { id: string; title: string; path: string; type: string; views: number; comments: number }[];
  ads: { id: string; name: string; slot: string; advertiser: string | null; impressions: number; clicks: number }[];
};

function dayList(from: string, n: number): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  for (let i = 0; i < n; i++) {
    out.push(new Date(d.getTime() + i * 86_400_000).toISOString().slice(0, 10));
  }
  return out;
}

/** `today` is the publication's current day (YYYY-MM-DD). */
export async function analyticsReport(db: Db, s: Site, today: string, range: number): Promise<AnalyticsReport> {
  const end = new Date(`${today}T00:00:00Z`).getTime();
  const from = new Date(end - (range - 1) * 86_400_000).toISOString().slice(0, 10);
  const prevFrom = new Date(end - (2 * range - 1) * 86_400_000).toISOString().slice(0, 10);
  const pub = eq(trafficDailyStats.publicationId, s.publicationId);

  const [traffic, stories, [prev], sources, top, ads] = await Promise.all([
    db
      .select({ day: trafficDailyStats.day, views: sql<number>`sum(${trafficDailyStats.views})::int` })
      .from(trafficDailyStats)
      .where(and(pub, gte(trafficDailyStats.day, from)))
      .groupBy(trafficDailyStats.day),
    db
      .select({ day: contentDailyStats.day, views: sql<number>`sum(${contentDailyStats.views})::int` })
      .from(contentDailyStats)
      .where(and(eq(contentDailyStats.publicationId, s.publicationId), gte(contentDailyStats.day, from)))
      .groupBy(contentDailyStats.day),
    db
      .select({ n: sql<number>`coalesce(sum(${trafficDailyStats.views}), 0)::int` })
      .from(trafficDailyStats)
      .where(and(pub, gte(trafficDailyStats.day, prevFrom), sql`${trafficDailyStats.day} < ${from}`)),
    db
      .select({ source: trafficDailyStats.source, views: sql<number>`sum(${trafficDailyStats.views})::int` })
      .from(trafficDailyStats)
      .where(and(pub, gte(trafficDailyStats.day, from)))
      .groupBy(trafficDailyStats.source)
      .orderBy(desc(sum(trafficDailyStats.views))),
    db
      .select({
        id: contentItems.id,
        title: contentItems.title,
        type: contentItems.type,
        slug: contentItems.slug,
        views: sql<number>`sum(${contentDailyStats.views})::int`,
      })
      .from(contentDailyStats)
      .innerJoin(contentItems, eq(contentItems.id, contentDailyStats.contentId))
      .where(and(eq(contentDailyStats.publicationId, s.publicationId), gte(contentDailyStats.day, from)))
      .groupBy(contentItems.id)
      .orderBy(desc(sum(contentDailyStats.views)))
      .limit(20),
    db
      .select({
        id: adPlacements.id,
        name: adPlacements.name,
        slot: adPlacements.slot,
        advertiser: adPlacements.advertiser,
        impressions: sql<number>`coalesce(sum(${adDailyStats.impressions}), 0)::int`,
        clicks: sql<number>`coalesce(sum(${adDailyStats.clicks}), 0)::int`,
      })
      .from(adPlacements)
      .leftJoin(adDailyStats, and(eq(adDailyStats.placementId, adPlacements.id), gte(adDailyStats.day, from)))
      .where(eq(adPlacements.publicationId, s.publicationId))
      .groupBy(adPlacements.id)
      .orderBy(desc(sql`coalesce(sum(${adDailyStats.impressions}), 0)`)),
  ]);

  const commentCounts = top.length
    ? await db
        .select({ id: comments.contentId, n: count() })
        .from(comments)
        .where(and(eq(comments.publicationId, s.publicationId), eq(comments.status, "approved"), inArray(comments.contentId, top.map((t) => t.id))))
        .groupBy(comments.contentId)
    : [];

  const byDay = new Map(traffic.map((t) => [t.day, t.views]));
  const storyByDay = new Map(stories.map((t) => [t.day, t.views]));
  const days = dayList(from, range).map((day) => ({ day, views: byDay.get(day) ?? 0, storyViews: storyByDay.get(day) ?? 0 }));
  return {
    days,
    total: days.reduce((a, d) => a + d.views, 0),
    storyViews: days.reduce((a, d) => a + d.storyViews, 0),
    previousTotal: prev?.n ?? 0,
    sources: sources.map((r) => ({ source: r.source as Source, views: r.views })),
    top: top.map((t) => ({ id: t.id, title: t.title, type: t.type, path: contentPath(t), views: t.views, comments: commentCounts.find((c) => c.id === t.id)?.n ?? 0 })),
    ads,
  };
}

/** Views per story over the last N days, for the content list. */
export async function viewsFor(db: Db, s: Site, ids: string[], since: string): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const rows = await db
    .select({ id: contentDailyStats.contentId, n: sql<number>`sum(${contentDailyStats.views})::int` })
    .from(contentDailyStats)
    .where(and(eq(contentDailyStats.publicationId, s.publicationId), gte(contentDailyStats.day, since), inArray(contentDailyStats.contentId, ids)))
    .groupBy(contentDailyStats.contentId);
  return new Map(rows.map((r) => [r.id, r.n]));
}
