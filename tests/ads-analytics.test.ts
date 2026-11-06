import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import * as t from "@/db/schema";
import { activeAds, recordClick, recordImpressions } from "@/data/ads";
import { analyticsReport, classifySource, contentIdForPath, isBot, recordView } from "@/data/analytics";
import { saveAd, saveAdsSettings } from "@/data/admin/ads";
import { site, type Site } from "@/data/site";
import { isoDay, shiftDay } from "@/lib/format";
import { makeContent, makePublication, setupTestDb } from "./helpers/db";

let db: Db;
let close: () => Promise<void>;
let s: Site;
let other: Site;
let pubId: string;
const DAY = "2026-11-05";
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";

beforeAll(async () => {
  ({ db, close } = await setupTestDb());
  const pub = await makePublication(db, "ads");
  pubId = pub.id;
  s = site(pub.id);
  other = site((await makePublication(db, "ads-other")).id);
});
afterAll(async () => close());

describe("traffic sources and bots", () => {
  it("classifies referrers by host only", () => {
    expect(classifySource(null, "mag.example", false)).toBe("direct");
    expect(classifySource("https://www.google.co.uk/", "mag.example", false)).toBe("search");
    expect(classifySource("https://duckduckgo.com/", "mag.example", false)).toBe("search");
    expect(classifySource("https://old.reddit.com/r/x", "mag.example", false)).toBe("social");
    expect(classifySource("https://t.co/abc", "mag.example", false)).toBe("social");
    expect(classifySource("https://mag.example/features/a", "mag.example:443", false)).toBe("internal");
    expect(classifySource("https://someblog.example/post", "mag.example", false)).toBe("referral");
    expect(classifySource("https://notgoogle.example/", "mag.example", false)).toBe("referral");
    expect(classifySource("garbage", "mag.example", false)).toBe("direct");
    expect(classifySource(null, "mag.example", true)).toBe("internal");
  });

  it("ignores bots, previews and tools", () => {
    expect(isBot(UA)).toBe(false);
    for (const ua of [null, "", "curl/8.0", "Googlebot/2.1 (+http://www.google.com/bot.html) Mozilla/5.0", "Mozilla/5.0 (X11) HeadlessChrome/120", "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"]) {
      expect(isBot(ua)).toBe(true);
    }
  });
});

describe("page views", () => {
  it("counts story views against the right story, only when it's live on this site", async () => {
    const story = await makeContent(db, pubId, { slug: "counted", type: "review" });
    const draft = await makeContent(db, pubId, { slug: "not-yet", status: "draft", publishedAt: null });
    const theirs = await makeContent(db, other.publicationId, { slug: "theirs" });
    expect(await contentIdForPath(db, s, "/reviews/counted")).toBe(story.id);
    expect(await contentIdForPath(db, s, "/features/counted")).toBeNull(); // wrong section
    expect(await contentIdForPath(db, s, "/features/not-yet")).toBeNull();
    expect(await contentIdForPath(db, s, "/features/theirs")).toBeNull();
    expect(await contentIdForPath(db, s, "/reviews/%E0%A4%A")).toBeNull(); // malformed encoding

    await recordView(db, s, { path: "/reviews/counted", source: "search", day: DAY });
    await recordView(db, s, { path: "/reviews/counted", source: "direct", day: DAY });
    await recordView(db, s, { path: "/", source: "direct", day: DAY });
    await recordView(db, s, { path: `/features/${draft.slug}`, source: "direct", day: DAY });
    expect(await recordView(db, s, { path: "/admin/content", source: "internal", day: DAY })).toBe(false);
    expect(await recordView(db, s, { path: "https://evil.example/", source: "direct", day: DAY })).toBe(false);
    void theirs;

    const [stat] = await db.select().from(t.contentDailyStats).where(eq(t.contentDailyStats.contentId, story.id));
    expect(stat.views).toBe(2);
    const traffic = await db.select().from(t.trafficDailyStats).where(eq(t.trafficDailyStats.publicationId, pubId));
    expect(Object.fromEntries(traffic.map((r) => [r.source, r.views]))).toEqual({ search: 1, direct: 3 });
  });

  it("reports totals, every day in the range, sources and the most read", async () => {
    await recordView(db, s, { path: "/", source: "direct", day: shiftDay(DAY, -3) });
    await recordView(db, s, { path: "/", source: "direct", day: shiftDay(DAY, -10) }); // previous period
    const r = await analyticsReport(db, s, DAY, 7);
    expect(r.days).toHaveLength(7);
    expect(r.days[6]).toEqual({ day: DAY, views: 4, storyViews: 2 });
    expect(r.days[3].views).toBe(1);
    expect(r.total).toBe(5);
    expect(r.previousTotal).toBe(1);
    expect(r.top[0]).toMatchObject({ path: "/reviews/counted", views: 2 });
    expect(r.sources[0]).toEqual({ source: "direct", views: 4 });
    // Nothing from this site shows up for the other one.
    expect((await analyticsReport(db, other, DAY, 7)).total).toBe(0);
  });

  it("buckets days in the publication's time zone", () => {
    const lateNightUtc = new Date("2026-11-05T23:30:00Z");
    expect(isoDay(lateNightUtc, "Europe/London")).toBe("2026-11-05");
    expect(isoDay(lateNightUtc, "Europe/Berlin")).toBe("2026-11-06");
    expect(isoDay(lateNightUtc, "America/New_York")).toBe("2026-11-05");
  });
});

describe("ads", () => {
  let imageId: string;
  let bannerId: string;
  let codeId: string;

  beforeAll(async () => {
    const [m] = await db.insert(t.media).values({ publicationId: pubId, storageKey: `${pubId}/2026/11/banner.png`, mimeType: "image/png", width: 300, height: 250 }).returning();
    imageId = m.id;
  });

  it("validates placements", async () => {
    const base = { slot: "in_content" as const, name: "Test", enabled: true, devices: ["mobile" as const, "desktop" as const] };
    await expect(saveAd(db, s, { ...base, kind: "code", code: "  " })).rejects.toThrow(/ad code/);
    await expect(saveAd(db, s, { ...base, kind: "image", imageId, clickUrl: "http://insecure.example" })).rejects.toThrow(/https/);
    await expect(saveAd(db, s, { ...base, kind: "image", imageId, clickUrl: "javascript:alert(1)" })).rejects.toThrow(/https/);
    await expect(saveAd(db, s, { ...base, kind: "image", clickUrl: "https://ok.example" })).rejects.toThrow(/banner image/);
    await expect(saveAd(db, s, { ...base, kind: "code", code: "<b>x</b>", devices: [] })).rejects.toThrow(/device/);
    await expect(saveAd(db, s, { ...base, kind: "code", code: "<b>x</b>", startsAt: "2026-12-02T00:00:00Z", endsAt: "2026-12-01T00:00:00Z" })).rejects.toThrow(/after the start/);
    const [foreign] = await db.insert(t.media).values({ publicationId: other.publicationId, storageKey: "x/y.png", mimeType: "image/png" }).returning();
    await expect(saveAd(db, s, { ...base, kind: "image", imageId: foreign.id, clickUrl: "https://ok.example" })).rejects.toThrow(/Unknown image/);
  });

  it("serves only running, complete placements for this site", async () => {
    const base = { slot: "in_content" as const, enabled: true, devices: ["mobile" as const, "desktop" as const] };
    bannerId = (await saveAd(db, s, { ...base, name: "Banner", kind: "image", imageId, clickUrl: "https://advertiser.example/?ref=mag", altText: "Sale" })).id;
    codeId = (await saveAd(db, s, { ...base, name: "Network", kind: "code", code: "<script src='https://ads.example/zone.js'></script>", weight: 3 })).id;
    await saveAd(db, s, { ...base, name: "Off", kind: "code", code: "<b>x</b>", enabled: false });
    await saveAd(db, s, { ...base, name: "Future", kind: "code", code: "<b>x</b>", startsAt: new Date(Date.now() + 86_400_000).toISOString() });
    await saveAd(db, s, { ...base, name: "Ended", kind: "code", code: "<b>x</b>", endsAt: new Date(Date.now() - 1000).toISOString() });
    await saveAd(db, other, { ...base, name: "Theirs", kind: "code", code: "<b>x</b>", slot: "footer" });

    const ads = await activeAds(db, s);
    expect(Object.keys(ads)).toEqual(["in_content"]);
    const list = ads.in_content!;
    expect(list.map((a) => a.id).sort()).toEqual([bannerId, codeId].sort());
    const banner = list.find((a) => a.id === bannerId)!;
    expect(banner.image?.src).toContain("banner.png");
    expect(banner.alt).toBe("Sale");
    // The advertiser's link never reaches the page; clicks go through the counter.
    expect(JSON.stringify(list)).not.toContain("advertiser.example");
    expect(list.find((a) => a.id === codeId)!.weight).toBe(3);
  });

  it("counts impressions for this site's placements only, capped per beacon", async () => {
    const [theirs] = await db.select().from(t.adPlacements).where(eq(t.adPlacements.publicationId, other.publicationId));
    expect(await recordImpressions(db, s, [codeId, codeId, ...Array(10).fill(bannerId), theirs.id, "nope"], DAY)).toBe(2);
    const rows = await db.select().from(t.adDailyStats);
    const by = Object.fromEntries(rows.map((r) => [r.placementId, r.impressions]));
    expect(by[codeId]).toBe(2);
    expect(by[bannerId]).toBe(5);
    expect(by[theirs.id]).toBeUndefined();
  });

  it("counts clicks and redirects only for this site's banners", async () => {
    expect(await recordClick(db, s, bannerId, DAY)).toBe("https://advertiser.example/?ref=mag");
    expect(await recordClick(db, s, bannerId, DAY, false)).toBe("https://advertiser.example/?ref=mag");
    expect(await recordClick(db, s, codeId, DAY)).toBeNull();
    expect(await recordClick(db, other, bannerId, DAY)).toBeNull();
    const [row] = await db.select().from(t.adDailyStats).where(eq(t.adDailyStats.placementId, bannerId));
    expect(row.clicks).toBe(1);
    const r = await analyticsReport(db, s, DAY, 7);
    expect(r.ads.find((a) => a.id === bannerId)).toMatchObject({ impressions: 5, clicks: 1 });
  });

  it("validates ad settings", async () => {
    await expect(saveAdsSettings(db, s, { previewPlaceholders: false, adsTxt: "", cloudflareToken: "not-a-token" })).rejects.toThrow(/32-character/);
    await saveAdsSettings(db, s, { previewPlaceholders: false, adsTxt: "example.com, pub-1, DIRECT\r\n", cloudflareToken: "0123456789abcdef0123456789abcdef" });
    const [p] = await db.select().from(t.publications).where(eq(t.publications.id, pubId));
    expect(p.settings.ads?.adsTxt).toBe("example.com, pub-1, DIRECT");
    expect(p.settings.analytics?.cloudflareToken).toBe("0123456789abcdef0123456789abcdef");
    expect(p.settings.commentsEnabled).toBe(true); // other settings untouched
  });
});
