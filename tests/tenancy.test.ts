import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import * as t from "@/db/schema";
import {
  getCardsByIds,
  getPublishedBySlug,
  listCategories,
  listPublished,
  listRelated,
  listSitemapEntries,
  listTrending,
} from "@/data/content";
import { getHomepage } from "@/data/homepage";
import { findPublicationByHost, normaliseHost } from "@/data/publications";
import { site } from "@/data/site";
import { makeContent, makePublication, setupTestDb } from "./helpers/db";

let db: Db;
let close: () => Promise<void>;
let a: Awaited<ReturnType<typeof makePublication>>;
let b: Awaited<ReturnType<typeof makePublication>>;
let aStory: typeof t.contentItems.$inferSelect;
let bStory: typeof t.contentItems.$inferSelect;

beforeAll(async () => {
  ({ db, close } = await setupTestDb());
  a = await makePublication(db, "alpha", "alpha.example.com");
  b = await makePublication(db, "beta", "beta.example.com");
  aStory = await makeContent(db, a.id, { slug: "shared-slug", title: "Alpha story" });
  bStory = await makeContent(db, b.id, { slug: "shared-slug", title: "Beta story" });
  await db.insert(t.categories).values([
    { publicationId: a.id, name: "Alpha cat", slug: "cat" },
    { publicationId: b.id, name: "Beta cat", slug: "cat" },
  ]);
  await db.insert(t.contentDailyStats).values({ publicationId: b.id, contentId: bStory.id, day: new Date().toISOString().slice(0, 10), views: 500 });
});

afterAll(async () => close());

describe("tenant isolation", () => {
  it("resolves each host to its own publication", async () => {
    expect((await findPublicationByHost(db, "alpha.example.com"))?.id).toBe(a.id);
    expect((await findPublicationByHost(db, "BETA.example.com:443"))?.id).toBe(b.id);
    expect(await findPublicationByHost(db, "unknown.example.com")).toBeNull();
  });

  it("does not resolve suspended publications", async () => {
    const s = await makePublication(db, "suspended", "suspended.example.com");
    await db.update(t.publications).set({ status: "suspended" }).where(eq(t.publications.id, s.id));
    expect(await findPublicationByHost(db, "suspended.example.com")).toBeNull();
  });

  it("the same slug in two publications returns each site's own story", async () => {
    expect((await getPublishedBySlug(db, site(a.id), "article", "shared-slug"))?.title).toBe("Alpha story");
    expect((await getPublishedBySlug(db, site(b.id), "article", "shared-slug"))?.title).toBe("Beta story");
  });

  it("lists only the site's own content", async () => {
    const ids = (await listPublished(db, site(a.id))).map((c) => c.id);
    expect(ids).toContain(aStory.id);
    expect(ids).not.toContain(bStory.id);
  });

  it("cannot fetch another site's content by id", async () => {
    expect(await getCardsByIds(db, site(a.id), [bStory.id])).toEqual([]);
  });

  it("ignores another site's content in manual related picks", async () => {
    await db.insert(t.relatedContent).values({ contentId: aStory.id, relatedId: bStory.id });
    const related = await listRelated(db, site(a.id), aStory.id);
    expect(related.map((r) => r.id)).not.toContain(bStory.id);
  });

  it("keeps trending, categories and sitemaps per site", async () => {
    expect((await listTrending(db, site(a.id))).map((c) => c.id)).not.toContain(bStory.id);
    expect((await listCategories(db, site(a.id))).map((c) => c.name)).toEqual(["Alpha cat"]);
    expect((await listSitemapEntries(db, site(a.id))).map((e) => e.slug)).toEqual(["shared-slug"]);
  });

  it("never shows another site's content on the homepage, even if picked", async () => {
    const [section] = await db
      .insert(t.homepageSections)
      .values({ publicationId: a.id, kind: "editors_picks", position: 0 })
      .returning();
    await db.insert(t.homepageSectionItems).values({ sectionId: section.id, contentId: bStory.id });
    const home = await getHomepage(db, site(a.id));
    const ids = home.flatMap((s) => ("items" in s ? s.items.map((i) => i.id) : []));
    expect(ids).not.toContain(bStory.id);
  });
});

describe("host normalisation", () => {
  it("lower-cases and strips ports", () => {
    expect(normaliseHost("Mag.Example.COM:8443")).toBe("mag.example.com");
    expect(normaliseHost("[::1]:3000")).toBe("[::1]");
  });
});
