import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import * as t from "@/db/schema";
import { saveContent, type ContentInput } from "@/data/admin/content";
import { getPublishedBySlug, listRelated } from "@/data/content";
import { site } from "@/data/site";
import { toEmbed } from "@/lib/embeds";
import type { Actor } from "@/lib/permissions";
import { search, searchTerms } from "@/lib/search";
import { reviewJsonLd, videoJsonLd } from "@/lib/seo";
import type { SiteContext } from "@/lib/site-context";
import { makeContent, makePublication, setupTestDb } from "./helpers/db";

let db: Db;
let close: () => Promise<void>;
let pub: Awaited<ReturnType<typeof makePublication>>;
let other: Awaited<ReturnType<typeof makePublication>>;
let studioId: string;
const editor: Actor = { userId: "u-ed", isSuperAdmin: false, role: "editor" };
const body = (text: string) => ({ type: "doc" as const, content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
const base = (over: Partial<ContentInput>): ContentInput => ({ type: "article", title: "T", body: body("x"), status: "published", ...over });

beforeAll(async () => {
  ({ db, close } = await setupTestDb());
  pub = await makePublication(db, "rvs", "rvs.example.com");
  other = await makePublication(db, "rvs-other");
  await db.insert(t.users).values({ id: "u-ed", name: "Ed", email: "ed@example.com" });
  const [studio] = await db.insert(t.entities).values({ publicationId: pub.id, kind: "studio", name: "Halcyon", slug: "halcyon" }).returning();
  studioId = studio.id;
});
afterAll(async () => close());

describe("reviews", () => {
  it("requires a score in half steps out of 5", async () => {
    const s = site(pub.id);
    await expect(saveContent(db, s, editor, base({ type: "review", title: "No score" }))).rejects.toThrow(/add a score/);
    await expect(saveContent(db, s, editor, base({ type: "review", title: "Odd", review: { score: 3.3 } }))).rejects.toThrow(/half steps/);
    await expect(saveContent(db, s, editor, base({ type: "review", title: "Big", review: { score: 6 } }))).rejects.toThrow();
  });

  it("saves pros, cons, pricing and a sponsored link, and links the studio", async () => {
    const s = site(pub.id);
    const r = await saveContent(
      db,
      s,
      editor,
      base({
        type: "review",
        title: "Velour Hours",
        slug: "velour-hours",
        review: { score: 4.5, verdict: "Confident.", pros: ["Lighting", " "], cons: ["Slow start"], subjectEntityId: studioId, releaseYear: 2026, pricing: "$7.99", affiliateUrl: "https://partner.example/ref" },
      }),
    );
    const page = await getPublishedBySlug(db, s, "review", "velour-hours");
    expect(page?.review?.score).toBe(4.5);
    expect(page?.review?.scoreMax).toBe(5);
    expect(page?.reviewFull?.pros).toEqual(["Lighting"]);
    expect(page?.reviewFull?.cons).toEqual(["Slow start"]);
    expect(page?.reviewFull?.subject?.name).toBe("Halcyon");
    const links = await db.select().from(t.contentEntities).where(eq(t.contentEntities.contentId, r.id));
    expect(links.map((l) => l.entityId)).toEqual([studioId]);
  });

  it("rejects non-https affiliate links and studios from another publication", async () => {
    const s = site(pub.id);
    await expect(saveContent(db, s, editor, base({ type: "review", review: { score: 3, affiliateUrl: "http://x.example" } }))).rejects.toThrow(/https/);
    const [foreign] = await db.insert(t.entities).values({ publicationId: other.id, kind: "studio", name: "Theirs", slug: "theirs" }).returning();
    await expect(saveContent(db, s, editor, base({ type: "review", review: { score: 3, subjectEntityId: foreign.id } }))).rejects.toThrow(/Unknown studio/);
  });

  it("drops review details when the type changes", async () => {
    const s = site(pub.id);
    const r = await saveContent(db, s, editor, base({ type: "review", title: "Was a review", review: { score: 2 } }));
    await saveContent(db, s, editor, base({ id: r.id, type: "article", title: "Was a review" }));
    expect(await db.select().from(t.reviewDetails).where(eq(t.reviewDetails.contentId, r.id))).toHaveLength(0);
  });

  it("emits honest Review markup with a 0–5 rating", async () => {
    const page = (await getPublishedBySlug(db, site(pub.id), "review", "velour-hours"))!;
    const ld = reviewJsonLd({ origin: "https://rvs.example.com", publication: pub, site: site(pub.id), host: "rvs.example.com", ads: { slots: [], preview: false } } as unknown as SiteContext, page)!;
    expect(ld["@type"]).toBe("Review");
    expect(ld.reviewRating).toMatchObject({ ratingValue: 4.5, bestRating: 5, worstRating: 0 });
    expect(ld.itemReviewed).toMatchObject({ "@type": "CreativeWork", name: "Velour Hours", creator: { "@type": "Organization", name: "Halcyon" } });
  });
});

describe("videos", () => {
  it("turns normal page links into approved embeds and rejects others", () => {
    expect(toEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({ provider: "youtube", url: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" });
    expect(toEmbed("https://youtu.be/dQw4w9WgXcQ")?.provider).toBe("youtube");
    expect(toEmbed("https://vimeo.com/123456")).toEqual({ provider: "vimeo", url: "https://player.vimeo.com/video/123456" });
    expect(toEmbed("https://evil.example/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(toEmbed("javascript:alert(1)")).toBeNull();
  });

  it("can't be published without an approved video link", async () => {
    const s = site(pub.id);
    await expect(saveContent(db, s, editor, base({ type: "video", title: "No link" }))).rejects.toThrow(/add the video link/);
    await expect(saveContent(db, s, editor, base({ type: "video", title: "Bad", video: { url: "https://evil.example/v/1" } }))).rejects.toThrow(/approved/);
    // A draft may wait for its link.
    await saveContent(db, s, editor, base({ type: "video", title: "Draft video", status: "draft" }));
  });

  it("stores the embed, duration, studio and optional rating", async () => {
    const s = site(pub.id);
    await saveContent(db, s, editor, base({ type: "video", title: "Night Swim", slug: "night-swim", video: { url: "https://vimeo.com/42", durationSeconds: 1725, studioEntityId: studioId, score: 4 } }));
    const page = (await getPublishedBySlug(db, s, "video", "night-swim"))!;
    expect(page.videoFull).toEqual({ provider: "vimeo", embedUrl: "https://player.vimeo.com/video/42", durationSeconds: 1725 });
    expect(page.review?.score).toBe(4);
    expect(page.video?.studio).toBe("Halcyon");
  });

  it("only emits VideoObject markup when there's a real thumbnail", async () => {
    const page = (await getPublishedBySlug(db, site(pub.id), "video", "night-swim"))!;
    const ctx = { origin: "https://rvs.example.com" } as unknown as SiteContext;
    expect(videoJsonLd(ctx, page)).toBeNull(); // no hero image
    const withThumb = { ...page, heroImage: { id: "m", storageKey: "p/2026/01/a.jpg", alt: "", width: 1, height: 1, blurColor: null, caption: null, credit: null } };
    expect(videoJsonLd(ctx, withThumb)).toMatchObject({ "@type": "VideoObject", duration: "PT28M45S", embedUrl: "https://player.vimeo.com/video/42" });
    const placeholder = { ...page, heroImage: { ...withThumb.heroImage, storageKey: "placeholder:#000000" } };
    expect(videoJsonLd(ctx, placeholder)).toBeNull();
  });
});

describe("search", () => {
  it("cleans input into safe terms", () => {
    expect(searchTerms("  Velour's  HOURS!! ")).toEqual(["velour", "s", "hours"]);
    expect(searchTerms("'); drop table users; --")).toEqual(["drop", "table", "users"]);
    expect(searchTerms("Après-ski")).toEqual(["apres", "ski"]);
    expect(searchTerms("   ")).toEqual([]);
  });

  it("finds published content by title, standfirst and body, with prefix matching", async () => {
    const s = site(pub.id);
    await saveContent(db, s, editor, base({ title: "Cinematographers explain gels", standfirst: "Practical lighting", body: body("Tungsten and daylight balance.") }));
    expect((await search.search(db, s, { q: "velo" })).items.map((i) => i.title)).toContain("Velour Hours");
    expect((await search.search(db, s, { q: "practical lighting" })).items.map((i) => i.title)).toContain("Cinematographers explain gels");
    expect((await search.search(db, s, { q: "daylight" })).items.map((i) => i.title)).toContain("Cinematographers explain gels");
    expect((await search.search(db, s, { q: "velour", types: ["video"] })).items).toHaveLength(0);
  });

  it("ranks title matches above body matches", async () => {
    const s = site(pub.id);
    await saveContent(db, s, editor, base({ title: "A flower story", body: body("orchid orchid") }));
    await saveContent(db, s, editor, base({ title: "Orchid in the title" }));
    const titles = (await search.search(db, s, { q: "orchid" })).items.map((i) => i.title);
    expect(titles[0]).toBe("Orchid in the title");
  });

  it("never returns drafts or another publication's content", async () => {
    const s = site(pub.id);
    await saveContent(db, s, editor, base({ title: "Secret draft zebra", status: "draft" }));
    await makeContent(db, other.id, { title: "Other site zebra", bodyText: "zebra" });
    expect((await search.search(db, s, { q: "zebra" })).items).toHaveLength(0);
  });
});

describe("related content", () => {
  it("prefers pieces about the same studio", async () => {
    const s = site(pub.id);
    const a = await saveContent(db, s, editor, base({ type: "review", title: "Studio review A", review: { score: 4, subjectEntityId: studioId } }));
    await saveContent(db, s, editor, base({ title: "Unrelated newer story" }));
    const rel = await listRelated(db, s, a.id, 3);
    expect(["Velour Hours", "Night Swim"]).toContain(rel[0].title);
  });
});
