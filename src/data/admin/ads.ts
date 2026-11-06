import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { adDailyStats, adPlacements, adSlot, media, publications } from "@/db/schema";
import type { Site } from "@/data/site";
import { assertOwned } from "./content";

export const AD_SLOTS = adSlot.enumValues;

export async function listAdsAdmin(db: Db, s: Site, since: string) {
  return db
    .select({
      id: adPlacements.id,
      slot: adPlacements.slot,
      name: adPlacements.name,
      kind: adPlacements.kind,
      code: adPlacements.code,
      imageId: adPlacements.imageId,
      storageKey: media.storageKey,
      clickUrl: adPlacements.clickUrl,
      altText: adPlacements.altText,
      advertiser: adPlacements.advertiser,
      enabled: adPlacements.enabled,
      devices: adPlacements.devices,
      weight: adPlacements.weight,
      startsAt: adPlacements.startsAt,
      endsAt: adPlacements.endsAt,
      impressions: sql<number>`coalesce(sum(${adDailyStats.impressions}), 0)::int`,
      clicks: sql<number>`coalesce(sum(${adDailyStats.clicks}), 0)::int`,
    })
    .from(adPlacements)
    .leftJoin(media, eq(media.id, adPlacements.imageId))
    .leftJoin(adDailyStats, and(eq(adDailyStats.placementId, adPlacements.id), gte(adDailyStats.day, since)))
    .where(eq(adPlacements.publicationId, s.publicationId))
    .groupBy(adPlacements.id, media.storageKey)
    .orderBy(adPlacements.slot, adPlacements.createdAt);
}

const optionalDate = z
  .string()
  .nullish()
  .transform((v) => (v ? new Date(v) : null))
  .refine((d) => d === null || !Number.isNaN(d.getTime()), "is not a valid date");

export const adInput = z
  .object({
    id: z.string().max(64).optional(),
    slot: z.enum(AD_SLOTS),
    name: z.string().trim().min(1, "is required").max(80),
    kind: z.enum(["code", "image"]),
    code: z.string().max(20_000).default(""),
    imageId: z.string().max(64).nullish(),
    clickUrl: z
      .string()
      .trim()
      .max(2000)
      .nullish()
      .transform((v) => v || null)
      .refine((v) => !v || /^https:\/\/[^\s]+$/.test(v), "must start with https://"),
    altText: z.string().trim().max(200).nullish().transform((v) => v || null),
    advertiser: z.string().trim().max(120).nullish().transform((v) => v || null),
    enabled: z.boolean(),
    devices: z.array(z.enum(["mobile", "desktop"])).min(1, "choose at least one device"),
    weight: z.number().int().min(1).max(100).default(1),
    startsAt: optionalDate,
    endsAt: optionalDate,
  })
  .superRefine((v, ctx) => {
    if (v.kind === "code" && v.enabled && !v.code.trim()) ctx.addIssue({ code: "custom", path: ["code"], message: "paste the ad code from your network" });
    if (v.kind === "image" && v.enabled && !v.imageId) ctx.addIssue({ code: "custom", path: ["imageId"], message: "choose a banner image" });
    if (v.kind === "image" && v.enabled && !v.clickUrl) ctx.addIssue({ code: "custom", path: ["clickUrl"], message: "add the advertiser's link" });
    if (v.startsAt && v.endsAt && v.endsAt <= v.startsAt) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "must be after the start" });
  });

export async function saveAd(db: Db, s: Site, raw: z.input<typeof adInput>) {
  const i = adInput.parse(raw);
  if (i.imageId) await assertOwned(db, s, media, [i.imageId], "image");
  const values = {
    slot: i.slot,
    name: i.name,
    kind: i.kind,
    code: i.kind === "code" ? i.code : "",
    imageId: i.kind === "image" ? (i.imageId ?? null) : null,
    clickUrl: i.kind === "image" ? i.clickUrl : null,
    altText: i.kind === "image" ? i.altText : null,
    advertiser: i.advertiser,
    enabled: i.enabled,
    devices: i.devices,
    weight: i.weight,
    startsAt: i.startsAt,
    endsAt: i.endsAt,
  };
  if (i.id) {
    const res = await db
      .update(adPlacements)
      .set(values)
      .where(and(eq(adPlacements.publicationId, s.publicationId), eq(adPlacements.id, i.id)))
      .returning({ id: adPlacements.id });
    if (!res.length) throw new Error("Placement not found");
    return { id: res[0].id, name: i.name };
  }
  const [row] = await db.insert(adPlacements).values({ publicationId: s.publicationId, ...values }).returning({ id: adPlacements.id });
  return { id: row.id, name: i.name };
}

export async function deleteAd(db: Db, s: Site, id: string) {
  const res = await db
    .delete(adPlacements)
    .where(and(eq(adPlacements.publicationId, s.publicationId), eq(adPlacements.id, id)))
    .returning({ name: adPlacements.name });
  if (!res.length) throw new Error("Placement not found");
  return res[0];
}

export const adsSettingsInput = z.object({
  previewPlaceholders: z.boolean(),
  adsTxt: z
    .string()
    .max(20_000)
    .transform((v) => v.replace(/\r\n?/g, "\n").trim())
    .refine((v) => v.split("\n").every((l) => l.length < 400), "has a line that's too long"),
  cloudflareToken: z
    .string()
    .trim()
    .max(64)
    .refine((v) => !v || /^[a-f0-9]{32}$/i.test(v), "should be the 32-character token from Cloudflare Web Analytics"),
});

export async function saveAdsSettings(db: Db, s: Site, raw: z.input<typeof adsSettingsInput>) {
  const i = adsSettingsInput.parse(raw);
  const [pub] = await db.select().from(publications).where(eq(publications.id, s.publicationId));
  await db
    .update(publications)
    .set({
      settings: {
        ...pub.settings,
        ads: { ...pub.settings.ads, previewPlaceholders: i.previewPlaceholders, adsTxt: i.adsTxt || undefined },
        analytics: { ...pub.settings.analytics, cloudflareToken: i.cloudflareToken || undefined },
      },
    })
    .where(eq(publications.id, s.publicationId));
}
