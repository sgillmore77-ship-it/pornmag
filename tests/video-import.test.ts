import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/client";
import * as t from "@/db/schema";
import { saveContent } from "@/data/admin/content";
import { saveSettings } from "@/data/admin/site";
import { approveVideoHost, checkFeedUrl, clearFeedCache, feedLabel, forgetRecentFeed, imageSize, importTiming, importVideos, MAX_RECENT_FEEDS, parseFeed, previewFeed, rememberRecentFeed, retryAfterMs } from "@/data/admin/video-import";
import { site, type Site } from "@/data/site";
import { embedSrc, iframeSrc, PARTNER, toEmbed } from "@/lib/embeds";
import type { Actor } from "@/lib/permissions";
import { makePublication, setupTestDb } from "./helpers/db";

// Storage writes go to R2 in production; here we only check what was stored.
vi.mock("@/lib/storage", () => ({ putObject: vi.fn(async () => {}) }));

// Real TubeCorporate (txxx.com) feed format: header row, "|" separator.
const HEADER = "Embed code|ID|Title|Duration|Website link|Main thumbnail|Thumbnail prefix|Categories|Tags|Models|Publish date, time";
const row = (id: number, title: string) =>
  `<iframe width="640" height="360" src="https://videotxxx.com/embed/${id}/?promo=49251" frameborder="0" allowfullscreen webkitallowfullscreen mozallowfullscreen oallowfullscreen msallowfullscreen></iframe>|${id}|${title}|1172|https://videotxxx.com/videos/${id}/slug/?promo=49251|1.jpg|https://tn.txxx.tube/contents/videos_screenshots/21837000/${id}/288x162/|Asian,Japanese,JAV Censored|||2026-11-07 03:49:56`;
const FEED = [HEADER, row(21837257, "First_Sample_Video_19min"), row(21837241, "Second sample"), "<iframe src=\"http://insecure.example/embed/1\"></iframe>|1|Bad|10||||||||", "too|few"].join("\n");

// A minimal valid JPEG header with a 288x162 frame.
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0xa2, 0x01, 0x20, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xff, 0xd9]);

let db: Db;
let close: () => Promise<void>;
let s: Site;
let other: Site;
const editor: Actor = { userId: "vi-ed", isSuperAdmin: false, role: "editor" };

function mockFetch(handler: (url: string) => Response) {
  vi.stubGlobal("fetch", vi.fn(async (u: string | URL) => handler(String(u))));
}

beforeAll(async () => {
  ({ db, close } = await setupTestDb());
  s = site((await makePublication(db, "vimp")).id);
  other = site((await makePublication(db, "vimp-other")).id);
  await db.insert(t.users).values({ id: "vi-ed", name: "Ed", email: "vi-ed@example.com" });
});
// Don't really wait between retries or thumbnails.
const waits: number[] = [];
importTiming.sleep = async (ms: number) => void waits.push(ms);
afterEach(() => {
  vi.unstubAllGlobals();
  clearFeedCache();
  waits.length = 0;
});
afterAll(async () => close());

describe("partner players", () => {
  it("reads embed code and only accepts approved partner hosts over https", () => {
    const code = '<iframe width="640" src="https://videotxxx.com/embed/21837257/?promo=49251" frameborder="0"></iframe>';
    expect(iframeSrc(code)).toBe("https://videotxxx.com/embed/21837257/?promo=49251");
    expect(toEmbed(code)).toBeNull(); // not approved yet
    expect(toEmbed(code, ["videotxxx.com"])).toEqual({ provider: PARTNER, url: "https://videotxxx.com/embed/21837257/?promo=49251" });
    expect(toEmbed("http://videotxxx.com/embed/1/", ["videotxxx.com"])).toBeNull();
    expect(toEmbed("https://evil.videotxxx.com.example/embed/1/", ["videotxxx.com"])).toBeNull();
    expect(embedSrc(PARTNER, "https://videotxxx.com/embed/1/?promo=49251", [])).toBeNull();
    expect(embedSrc(PARTNER, "https://user:pw@videotxxx.com/embed/1/", ["videotxxx.com"])).toBeNull();
    // YouTube still works, including pasted embed code.
    expect(toEmbed('<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>')?.provider).toBe("youtube");
  });

  it("validates the approved list in Settings", async () => {
    const base = { name: "Vimp", primaryColor: "#7A1F3D", fontPairing: "couture" as const, layout: "issue" as const, mode: "system" as const, ageGateEnabled: true, commentsEnabled: true, timeZone: "Europe/London", nav: [] };
    await expect(saveSettings(db, s, { ...base, videoHosts: ["not a host"] })).rejects.toThrow(/website names/);
    await saveSettings(db, s, { ...base, videoHosts: ["https://www.VideoTxxx.com/embed/", "videotxxx.com"] });
    const [p] = await db.select().from(t.publications).where(eq(t.publications.id, s.publicationId));
    expect(p.settings.videoHosts).toEqual(["videotxxx.com"]);
  });

  it("lets video stories use approved partner players only", async () => {
    const draft = { type: "video" as const, title: "Partner clip", body: { type: "doc" as const, content: [] }, status: "published" as const };
    await expect(saveContent(db, other, editor, { ...draft, video: { url: "https://videotxxx.com/embed/5/?promo=49251" } })).rejects.toThrow(/approved/);
    const saved = await saveContent(db, s, editor, { ...draft, video: { url: '<iframe src="https://videotxxx.com/embed/5/?promo=49251"></iframe>' } });
    const [v] = await db.select().from(t.videoDetails).where(eq(t.videoDetails.contentId, saved.id));
    expect(v).toMatchObject({ provider: PARTNER, embedUrl: "https://videotxxx.com/embed/5/?promo=49251" });
  });
});

describe("feeds", () => {
  it("parses the TubeCorporate CSV format", () => {
    const { videos, skippedRows } = parseFeed(FEED);
    expect(skippedRows).toBe(2);
    expect(videos).toHaveLength(2);
    expect(videos[0]).toMatchObject({
      sourceId: "21837257",
      title: "First Sample Video 19min",
      durationSeconds: 1172,
      embedUrl: "https://videotxxx.com/embed/21837257/?promo=49251",
      embedHost: "videotxxx.com",
      thumbUrl: "https://tn.txxx.tube/contents/videos_screenshots/21837000/21837257/288x162/1.jpg",
      categories: ["Asian", "Japanese", "JAV Censored"],
      tags: [],
    });
    expect(() => parseFeed("ID|Duration\n1|20")).toThrow(/Embed code/);
  });

  it("only fetches public https feed links", () => {
    for (const bad of ["http://txxx.com/feed", "https://localhost/feed", "https://127.0.0.1/x", "https://[::1]/x", "https://user:pw@txxx.com/", "https://intranet/x", "not a url"]) {
      expect(() => checkFeedUrl(bad)).toThrow();
    }
    expect(checkFeedUrl("https://txxx.com/admin/feeds/promo/?promo=49251").hostname).toBe("txxx.com");
  });

  it("reads image sizes from headers", () => {
    expect(imageSize(JPEG)).toEqual({ width: 288, height: 162 });
    const png = new Uint8Array(24);
    png.set([0x89, 0x50, 0x4e, 0x47]);
    png.set([0, 0, 1, 0x20], 16);
    png.set([0, 0, 0, 0xa2], 20);
    expect(imageSize(png)).toEqual({ width: 288, height: 162 });
  });

  it("previews a feed, flagging unapproved players and already-imported videos", async () => {
    mockFetch(() => new Response(FEED));
    const fresh = site((await makePublication(db, "vimp-fresh")).id);
    let p = await previewFeed(db, fresh, "https://txxx.com/admin/feeds/promo/?promo=49251");
    expect(p.unapprovedHosts).toEqual(["videotxxx.com"]);
    expect(p.videos.every((v) => !v.approved)).toBe(true);
    await approveVideoHost(db, fresh, "www.videotxxx.com");
    p = await previewFeed(db, fresh, "https://txxx.com/admin/feeds/promo/?promo=49251");
    expect(p.unapprovedHosts).toEqual([]);
    expect(p.videos.map((v) => [v.approved, v.imported])).toEqual([
      [true, false],
      [true, false],
    ]);
  });
});

describe("importing", () => {
  it("creates draft video stories with a copied thumbnail, tags and no duplicates", async () => {
    const { videos } = parseFeed(FEED);
    const fetched: string[] = [];
    mockFetch((u) => {
      fetched.push(u);
      return new Response(JPEG, { headers: { "content-type": "image/jpeg" } });
    });
    const r = await importVideos(db, s, editor, videos, { categoriesAsTags: true, tagsAsTags: false });
    expect(r.imported).toHaveLength(2);
    expect(fetched[0]).toBe("https://tn.txxx.tube/contents/videos_screenshots/21837000/21837257/288x162/1.jpg");

    const [item] = await db.select().from(t.contentItems).where(eq(t.contentItems.id, r.imported[0].id));
    expect(item).toMatchObject({ type: "video", status: "draft", title: "First Sample Video 19min" });
    const [hero] = await db.select().from(t.media).where(eq(t.media.id, item.heroImageId!));
    expect(hero).toMatchObject({ publicationId: s.publicationId, mimeType: "image/jpeg", width: 288, height: 162 });
    expect(hero.storageKey.startsWith("placeholder:")).toBe(false);
    const [vd] = await db.select().from(t.videoDetails).where(eq(t.videoDetails.contentId, item.id));
    expect(vd).toMatchObject({ provider: PARTNER, durationSeconds: 1172 });
    const tags = await db.select({ name: t.tags.name }).from(t.contentTags).innerJoin(t.tags, eq(t.tags.id, t.contentTags.tagId)).where(eq(t.contentTags.contentId, item.id));
    expect(tags.map((x) => x.name).sort()).toEqual(["Asian", "JAV Censored", "Japanese"]);

    const again = await importVideos(db, s, editor, videos, { categoriesAsTags: false, tagsAsTags: false });
    expect(again.imported).toHaveLength(0);
    expect(again.skipped.map((x) => x.reason)).toEqual(["already imported", "already imported"]);
  });

  it("skips unapproved players and still imports when a thumbnail fails", async () => {
    const { videos } = parseFeed(FEED.replaceAll("21837", "99999"));
    mockFetch(() => new Response("nope", { status: 404 }));
    const r1 = await importVideos(db, other, editor, videos, { categoriesAsTags: false, tagsAsTags: false });
    expect(r1.imported).toHaveLength(0);
    expect(r1.skipped[0].reason).toMatch(/approved/);
    const r2 = await importVideos(db, s, editor, videos.slice(0, 1), { categoriesAsTags: false, tagsAsTags: false });
    expect(r2.skipped).toEqual([]);
    expect(r2.imported).toHaveLength(1);
    const [item] = await db.select().from(t.contentItems).where(eq(t.contentItems.id, r2.imported[0].id));
    expect(item.heroImageId).toBeNull();
  });

  it("needs permission to create content", async () => {
    const { videos } = parseFeed(FEED.replaceAll("21837", "77777"));
    mockFetch(() => new Response(JPEG));
    const reader: Actor = { userId: "vi-ed", isSuperAdmin: false, role: "user" };
    const r = await importVideos(db, s, reader, videos.slice(0, 1), { categoriesAsTags: false, tagsAsTags: false });
    expect(r.imported).toHaveLength(0);
    expect(r.skipped[0].reason).toMatch(/permission|not allowed|Forbidden/i);
  });
});

describe("web addresses", () => {
  it("adds -2, -3 to repeated titles but refuses a typed address that's taken", async () => {
    const base = { type: "article" as const, title: "Same Title", body: { type: "doc" as const, content: [] }, status: "draft" as const };
    const a = await saveContent(db, other, editor, base);
    const b = await saveContent(db, other, editor, base);
    const c = await saveContent(db, other, editor, base);
    expect([a.slug, b.slug, c.slug]).toEqual(["same-title", "same-title-2", "same-title-3"]);
    // Re-saving keeps its own address.
    expect((await saveContent(db, other, editor, { ...base, id: b.id, slug: "same-title-2" })).slug).toBe("same-title-2");
    await expect(saveContent(db, other, editor, { ...base, slug: "same-title" })).rejects.toThrow(/already uses/);
  });
});

describe("busy partner servers", () => {
  const url = "https://txxx.com/admin/feeds/promo/?promo=49251&busy=1";

  it("reads Retry-After as seconds or a date", () => {
    expect(retryAfterMs("3")).toBe(3000);
    expect(retryAfterMs(null)).toBe(2000);
    expect(retryAfterMs("nonsense")).toBe(2000);
    expect(retryAfterMs(new Date(10_000).toUTCString(), 4_000)).toBe(6000);
  });

  it("waits and retries when the partner says it's busy", async () => {
    let calls = 0;
    mockFetch(() => (++calls < 3 ? new Response("slow down", { status: 429, headers: { "retry-after": "2" } }) : new Response(FEED)));
    const p = await previewFeed(db, s, url);
    expect(p.videos).toHaveLength(2);
    expect(calls).toBe(3);
    expect(waits).toEqual([2000, 2000]);
  });

  it("gives a plain explanation when it stays busy, without waiting for ages", async () => {
    mockFetch(() => new Response("slow down", { status: 429, headers: { "retry-after": "120" } }));
    await expect(previewFeed(db, s, url)).rejects.toThrow(/limiting how often feeds can be downloaded/);
    expect(waits).toEqual([]);
    mockFetch(() => new Response("slow down", { status: 429 }));
    await expect(previewFeed(db, s, url)).rejects.toThrow(/Wait a few minutes/);
    expect(waits.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(12_000);
  });

  it("doesn't download the same feed again within a few minutes, and falls back to the last copy if busy", async () => {
    let calls = 0;
    mockFetch(() => (calls++, new Response(FEED)));
    await previewFeed(db, s, url);
    await previewFeed(db, s, url);
    expect(calls).toBe(1);
    // Older than the fresh window: tries again, and uses the saved copy when refused.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 10 * 60_000);
    mockFetch(() => new Response("slow down", { status: 429, headers: { "retry-after": "999" } }));
    expect((await previewFeed(db, s, url)).videos).toHaveLength(2);
    vi.useRealTimers();
  });

  it("other errors aren't retried", async () => {
    let calls = 0;
    mockFetch(() => (calls++, new Response("nope", { status: 404 })));
    await expect(previewFeed(db, s, url)).rejects.toThrow("The partner's server answered 404.");
    expect(calls).toBe(1);
  });
});

describe("recent feeds", () => {
  const read = async (pub: Site) => (await db.select().from(t.publications).where(eq(t.publications.id, pub.publicationId)))[0].settings.recentFeeds ?? [];

  it("names feeds by site and categories", () => {
    expect(feedLabel("https://txxx.com/admin/feeds/promo/?promo=1")).toBe("txxx.com · all videos");
    expect(feedLabel("https://www.txxx.com/admin/feeds/promo/?promo=1&categories=Asian%2CJapanese")).toBe("txxx.com · Asian, Japanese");
    expect(feedLabel("https://txxx.com/f/?categories=A,B,C,D,E")).toBe("txxx.com · A, B, C +2");
  });

  it("keeps the newest first, without duplicates, up to the limit, per publication", async () => {
    const urls = Array.from({ length: MAX_RECENT_FEEDS + 2 }, (_, i) => `https://txxx.com/admin/feeds/promo/?promo=49251&n=${i}`);
    for (const u of urls) await rememberRecentFeed(db, s, u);
    await rememberRecentFeed(db, s, urls[5]);
    const list = await read(s);
    expect(list).toHaveLength(MAX_RECENT_FEEDS);
    expect(list[0].url).toBe(urls[5]);
    expect(new Set(list.map((f) => f.url)).size).toBe(MAX_RECENT_FEEDS);
    expect(await read(other)).toEqual([]);
    await forgetRecentFeed(db, s, urls[5]);
    expect((await read(s)).some((f) => f.url === urls[5])).toBe(false);
  });

  it("refuses links that aren't public https feeds", async () => {
    await expect(rememberRecentFeed(db, s, "http://txxx.com/feed")).rejects.toThrow();
    await expect(rememberRecentFeed(db, s, "https://localhost/feed")).rejects.toThrow();
  });

  it("survives saving Settings", async () => {
    const before = await read(s);
    const base = { name: "Vimp", primaryColor: "#7A1F3D", fontPairing: "couture" as const, layout: "issue" as const, mode: "system" as const, ageGateEnabled: true, commentsEnabled: true, timeZone: "Europe/London", nav: [] };
    await saveSettings(db, s, base);
    expect(await read(s)).toEqual(before);
  });
});
