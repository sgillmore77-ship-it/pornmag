import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import * as t from "@/db/schema";
import { getPublishedBySlug, listPublished, listRelated } from "@/data/content";
import { getHomepage } from "@/data/homepage";
import { site } from "@/data/site";
import { makeContent, makePublication, setupTestDb } from "./helpers/db";

let db: Db;
let close: () => Promise<void>;
let pubId: string;

beforeAll(async () => {
  ({ db, close } = await setupTestDb());
  pubId = (await makePublication(db, "visibility")).id;
});
afterAll(async () => close());

describe("what readers can see", () => {
  it("hides drafts, archived and future-dated content", async () => {
    const live = await makeContent(db, pubId, { slug: "live" });
    await makeContent(db, pubId, { slug: "draft", status: "draft" });
    await makeContent(db, pubId, { slug: "archived", status: "archived" });
    await makeContent(db, pubId, { slug: "future", publishedAt: new Date(Date.now() + 86_400_000) });
    await makeContent(db, pubId, { slug: "scheduled", status: "scheduled", scheduledFor: new Date(Date.now() - 1000) });

    const slugs = (await listPublished(db, site(pubId), { limit: 50 })).map((c) => c.slug);
    expect(slugs).toContain(live.slug);
    for (const hidden of ["draft", "archived", "future", "scheduled"]) {
      expect(slugs).not.toContain(hidden);
      expect(await getPublishedBySlug(db, site(pubId), "article", hidden)).toBeNull();
    }
  });

  it("requires the URL section to match the content type", async () => {
    await makeContent(db, pubId, { slug: "a-review", type: "review" });
    expect(await getPublishedBySlug(db, site(pubId), "article", "a-review")).toBeNull();
    expect(await getPublishedBySlug(db, site(pubId), "review", "a-review")).not.toBeNull();
  });
});

describe("related content", () => {
  it("prefers editor picks, then shared tags, and never includes itself", async () => {
    const main = await makeContent(db, pubId, { slug: "main-story" });
    const picked = await makeContent(db, pubId, { slug: "picked" });
    const tagged = await makeContent(db, pubId, { slug: "tagged", publishedAt: new Date(Date.now() - 30 * 86_400_000) });
    const [tag] = await db.insert(t.tags).values({ publicationId: pubId, name: "x", slug: "x" }).returning();
    await db.insert(t.contentTags).values([
      { contentId: main.id, tagId: tag.id },
      { contentId: tagged.id, tagId: tag.id },
    ]);
    await db.insert(t.relatedContent).values({ contentId: main.id, relatedId: picked.id });

    const related = (await listRelated(db, site(pubId), main.id, 3)).map((r) => r.slug);
    expect(related[0]).toBe("picked");
    expect(related[1]).toBe("tagged");
    expect(related).not.toContain("main-story");
  });
});

describe("homepage", () => {
  it("follows section order, skips disabled sections and doesn't repeat stories across grids", async () => {
    const pub = await makePublication(db, "homepage");
    const s = site(pub.id);
    for (let i = 0; i < 6; i++) await makeContent(db, pub.id, { slug: `h-${i}`, isFeatured: i === 3 });
    await db.insert(t.homepageSections).values([
      { publicationId: pub.id, kind: "hero", position: 0 },
      { publicationId: pub.id, kind: "latest", position: 1, config: { limit: 3 } },
      { publicationId: pub.id, kind: "editors_picks", position: 2, enabled: false },
    ]);
    const home = await getHomepage(db, s);
    expect(home.map((x) => x.kind)).toEqual(["hero", "latest"]);
    const hero = home[0] as { items: { slug: string }[] };
    const latest = home[1] as { items: { slug: string }[] };
    expect(hero.items[0].slug).toBe("h-3"); // featured story leads
    expect(latest.items).toHaveLength(3);
    expect(latest.items.map((i) => i.slug)).not.toContain("h-3");
  });
});

describe("homepage: video-first sections", () => {
  const ago = (min: number) => new Date(Date.now() - min * 60_000);
  const slugs = (sec: unknown) => (sec as { items: { slug: string }[] }).items.map((i) => i.slug);

  it("Latest covers every story type, newest first", async () => {
    const pub = await makePublication(db, "latest-all");
    await makeContent(db, pub.id, { slug: "old-article", publishedAt: ago(30) });
    await makeContent(db, pub.id, { slug: "new-video", type: "video", publishedAt: ago(1) });
    await makeContent(db, pub.id, { slug: "mid-review", type: "review", publishedAt: ago(10) });
    await db.insert(t.homepageSections).values({ publicationId: pub.id, kind: "latest", position: 0 });
    const [latest] = await getHomepage(db, site(pub.id));
    expect(slugs(latest)).toEqual(["new-video", "mid-review", "old-article"]);
  });

  it("Latest still honours a type filter set on the section", async () => {
    const pub = await makePublication(db, "latest-filter");
    await makeContent(db, pub.id, { slug: "f-article" });
    await makeContent(db, pub.id, { slug: "f-video", type: "video" });
    await db.insert(t.homepageSections).values({ publicationId: pub.id, kind: "latest", position: 0, config: { contentTypes: ["article"] } });
    const [latest] = await getHomepage(db, site(pub.id));
    expect(slugs(latest)).toEqual(["f-article"]);
  });

  it("Editor's picks: pinned first, then ticked stories; never unticked ones", async () => {
    const pub = await makePublication(db, "picks");
    const pinned = await makeContent(db, pub.id, { slug: "pinned", publishedAt: ago(50) });
    await makeContent(db, pub.id, { slug: "ticked-new", isEditorsPick: true, publishedAt: ago(2) });
    await makeContent(db, pub.id, { slug: "ticked-old", isEditorsPick: true, type: "video", publishedAt: ago(20) });
    await makeContent(db, pub.id, { slug: "plain", publishedAt: ago(1) });
    await makeContent(db, pub.id, { slug: "ticked-draft", isEditorsPick: true, status: "draft" });
    const [sec] = await db.insert(t.homepageSections).values({ publicationId: pub.id, kind: "editors_picks", position: 0, config: { limit: 3 } }).returning();
    await db.insert(t.homepageSectionItems).values({ sectionId: sec.id, contentId: pinned.id, position: 0 });
    const [picks] = await getHomepage(db, site(pub.id));
    expect(slugs(picks)).toEqual(["pinned", "ticked-new", "ticked-old"]);
  });

  it("Videos: pinned, then Featured videos, then the newest", async () => {
    const pub = await makePublication(db, "videos-featured");
    await makeContent(db, pub.id, { slug: "v-new", type: "video", publishedAt: ago(1) });
    await makeContent(db, pub.id, { slug: "v-featured-old", type: "video", isFeatured: true, publishedAt: ago(60) });
    await makeContent(db, pub.id, { slug: "v-mid", type: "video", publishedAt: ago(10) });
    await makeContent(db, pub.id, { slug: "an-article", isFeatured: true });
    await db.insert(t.homepageSections).values({ publicationId: pub.id, kind: "featured_videos", position: 0 });
    const [videos] = await getHomepage(db, site(pub.id));
    expect(slugs(videos)).toEqual(["v-featured-old", "v-new", "v-mid"]);
  });
});

describe("stories in more than one category", () => {
  it("shows a story on its main category page and on each extra one, and counts it in each", async () => {
    const pub = await makePublication(db, "multi-cat");
    const s = site(pub.id);
    const [redhead, dap, other] = await db
      .insert(t.categories)
      .values([
        { publicationId: pub.id, name: "Redhead ATM", slug: "redhead-atm" },
        { publicationId: pub.id, name: "Double Anal ATM", slug: "double-anal-atm" },
        { publicationId: pub.id, name: "Other", slug: "other" },
      ])
      .returning();
    const story = await makeContent(db, pub.id, { slug: "redhead-dap", type: "video", categoryId: redhead.id });
    await db.insert(t.contentCategories).values({ contentId: story.id, categoryId: dap.id });

    expect((await listPublished(db, s, { categoryId: redhead.id })).map((c) => c.slug)).toEqual(["redhead-dap"]);
    expect((await listPublished(db, s, { categoryId: dap.id })).map((c) => c.slug)).toEqual(["redhead-dap"]);
    expect(await listPublished(db, s, { categoryId: other.id })).toEqual([]);

    const { listCategories } = await import("@/data/content");
    const counts = Object.fromEntries((await listCategories(db, s)).map((c) => [c.slug, c.count]));
    expect(counts).toMatchObject({ "redhead-atm": 1, "double-anal-atm": 1, other: 0 });
    // The card still names the main category.
    expect((await listPublished(db, s, { categoryId: dap.id }))[0].category?.slug).toBe("redhead-atm");
  });
});
