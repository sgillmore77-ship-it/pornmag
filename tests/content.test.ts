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
