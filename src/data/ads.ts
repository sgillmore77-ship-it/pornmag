import { and, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { adDailyStats, adPlacements, media } from "@/db/schema";
import { mediaUrl } from "@/lib/media";
import type { Site } from "./site";

export type AdSlotName = (typeof adPlacements.$inferSelect)["slot"];

/** What a page needs to show one ad. Click targets stay on the server. */
export type AdCreative = {
  id: string;
  kind: "code" | "image";
  code?: string;
  image?: { src: string; width: number | null; height: number | null };
  alt?: string;
  devices: string[];
  weight: number;
  /** ISO times, re-checked in the browser because pages are cached. */
  startsAt: string | null;
  endsAt: string | null;
};

const live = (now: Date) =>
  and(
    eq(adPlacements.enabled, true),
    or(isNull(adPlacements.startsAt), lte(adPlacements.startsAt, now)),
    or(isNull(adPlacements.endsAt), gt(adPlacements.endsAt, now)),
  );

/** Switched-on placements that are running now, grouped by slot. */
export async function activeAds(db: Db, s: Site, now = new Date()): Promise<Partial<Record<AdSlotName, AdCreative[]>>> {
  const rows = await db
    .select({ p: adPlacements, storageKey: media.storageKey, width: media.width, height: media.height })
    .from(adPlacements)
    .leftJoin(media, and(eq(media.id, adPlacements.imageId), eq(media.publicationId, adPlacements.publicationId)))
    .where(and(eq(adPlacements.publicationId, s.publicationId), live(now)));
  const out: Partial<Record<AdSlotName, AdCreative[]>> = {};
  for (const { p, storageKey, width, height } of rows) {
    if (p.kind === "code" && !p.code.trim()) continue;
    if (p.kind === "image" && (!storageKey || !p.clickUrl)) continue;
    (out[p.slot] ??= []).push({
      id: p.id,
      kind: p.kind,
      code: p.kind === "code" ? p.code : undefined,
      image: p.kind === "image" && storageKey ? { src: mediaUrl(storageKey), width, height } : undefined,
      alt: p.kind === "image" ? (p.altText ?? p.name) : undefined,
      devices: p.devices,
      weight: Math.max(1, p.weight),
      startsAt: p.startsAt?.toISOString() ?? null,
      endsAt: p.endsAt?.toISOString() ?? null,
    });
  }
  return out;
}

/** Adds impressions for placements that belong to this publication. */
export async function recordImpressions(db: Db, s: Site, ids: string[], day: string) {
  const counts = new Map<string, number>();
  for (const id of ids.slice(0, 20)) counts.set(id, Math.min(5, (counts.get(id) ?? 0) + 1));
  if (!counts.size) return 0;
  const owned = await db
    .select({ id: adPlacements.id })
    .from(adPlacements)
    .where(and(eq(adPlacements.publicationId, s.publicationId), inArray(adPlacements.id, [...counts.keys()])));
  for (const { id } of owned) {
    const n = counts.get(id)!;
    await db
      .insert(adDailyStats)
      .values({ publicationId: s.publicationId, placementId: id, day, impressions: n })
      .onConflictDoUpdate({ target: [adDailyStats.placementId, adDailyStats.day], set: { impressions: sql`${adDailyStats.impressions} + ${n}` } });
  }
  return owned.length;
}

/** Counts a click and returns where to send the reader, or null for unknown ads. */
export async function recordClick(db: Db, s: Site, id: string, day: string, count = true): Promise<string | null> {
  const [p] = await db
    .select({ clickUrl: adPlacements.clickUrl })
    .from(adPlacements)
    .where(and(eq(adPlacements.publicationId, s.publicationId), eq(adPlacements.id, id), eq(adPlacements.kind, "image")));
  if (!p?.clickUrl || !/^https:\/\//.test(p.clickUrl)) return null;
  if (!count) return p.clickUrl;
  await db
    .insert(adDailyStats)
    .values({ publicationId: s.publicationId, placementId: id, day, clicks: 1 })
    .onConflictDoUpdate({ target: [adDailyStats.placementId, adDailyStats.day], set: { clicks: sql`${adDailyStats.clicks} + 1` } });
  return p.clickUrl;
}
