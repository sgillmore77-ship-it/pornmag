import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import * as t from "@/db/schema";
import { canEditItem, publishDue, saveContent, type ContentInput } from "@/data/admin/content";
import { sniffImageType, storageKeyFor } from "@/data/admin/media";
import { findRedirect, normalisePath, saveHomepage, saveRedirect, saveSettings } from "@/data/admin/site";
import { authorForUser, deleteAuthor, saveCategory, saveTag } from "@/data/admin/taxonomy";
import { getPublishedBySlug, listPublished } from "@/data/content";
import { site } from "@/data/site";
import type { Actor } from "@/lib/permissions";
import { makeContent, makePublication, setupTestDb } from "./helpers/db";

let db: Db;
let close: () => Promise<void>;
let pub: Awaited<ReturnType<typeof makePublication>>;
let other: Awaited<ReturnType<typeof makePublication>>;
const users: Record<string, string> = {};

const actor = (role: Actor["role"], key: string): Actor => ({ userId: users[key], isSuperAdmin: false, role });
const body = { type: "doc" as const, content: [{ type: "paragraph", content: [{ type: "text", text: "Hello world" }] }] };
const base = (over: Partial<ContentInput> = {}): ContentInput => ({ type: "article", title: "A story", body, status: "draft", ...over });

beforeAll(async () => {
  ({ db, close } = await setupTestDb());
  pub = await makePublication(db, "adm");
  other = await makePublication(db, "adm-other");
  for (const key of ["editor", "author", "author2"]) {
    const id = `u-${key}`;
    await db.insert(t.users).values({ id, name: key, email: `${key}@example.com` });
    users[key] = id;
  }
});
afterAll(async () => close());

describe("editorial workflow", () => {
  it("lets an author save drafts but not publish or schedule", async () => {
    const s = site(pub.id);
    const r = await saveContent(db, s, actor("author", "author"), base({ title: "Author draft" }));
    expect(r.status).toBe("draft");
    await expect(saveContent(db, s, actor("author", "author"), base({ status: "published" }))).rejects.toThrow(/permission/i);
    await expect(
      saveContent(db, s, actor("author", "author"), base({ status: "scheduled", scheduledFor: new Date(Date.now() + 3600_000).toISOString() })),
    ).rejects.toThrow(/permission/i);
  });

  it("stops authors editing other people's work, or anything already published", async () => {
    const s = site(pub.id);
    const mine = await saveContent(db, s, actor("author", "author"), base({ title: "Mine" }));
    expect(await canEditItem(db, s, actor("author", "author"), mine.id)).toBe(true);
    expect(await canEditItem(db, s, actor("author", "author2"), mine.id)).toBe(false);
    await expect(saveContent(db, s, actor("author", "author2"), base({ id: mine.id, title: "Hijack" }))).rejects.toThrow(/permission/i);

    await saveContent(db, s, actor("editor", "editor"), base({ id: mine.id, title: "Mine", status: "published" }));
    expect(await canEditItem(db, s, actor("author", "author"), mine.id)).toBe(false);
    expect(await canEditItem(db, s, actor("editor", "editor"), mine.id)).toBe(true);
  });

  it("publishes with today's date and keeps the original date on later edits", async () => {
    const s = site(pub.id);
    const first = new Date("2026-01-01T10:00:00Z");
    const r = await saveContent(db, s, actor("editor", "editor"), base({ title: "Dated", status: "published" }), first);
    await saveContent(db, s, actor("editor", "editor"), base({ id: r.id, title: "Dated (updated)", status: "published" }), new Date("2026-02-01T10:00:00Z"));
    const [row] = await db.select().from(t.contentItems).where(eq(t.contentItems.id, r.id));
    expect(row.publishedAt?.toISOString()).toBe(first.toISOString());
    expect(row.title).toBe("Dated (updated)");
    expect(row.bodyText).toBe("Hello world");
  });

  it("schedules for the future only, then publishes when due", async () => {
    const s = site(pub.id);
    const ed = actor("editor", "editor");
    await expect(saveContent(db, s, ed, base({ status: "scheduled" }))).rejects.toThrow(/choose a date/);
    await expect(saveContent(db, s, ed, base({ status: "scheduled", scheduledFor: new Date(Date.now() - 60_000).toISOString() }))).rejects.toThrow(/future/);

    const when = new Date(Date.now() + 3600_000);
    const r = await saveContent(db, s, ed, base({ title: "Later", slug: "later", status: "scheduled", scheduledFor: when.toISOString() }));
    expect(await getPublishedBySlug(db, s, "article", "later")).toBeNull();

    expect((await publishDue(db, new Date())).map((p) => p.id)).not.toContain(r.id);
    const done = await publishDue(db, new Date(when.getTime() + 1000));
    expect(done.map((p) => p.id)).toContain(r.id);
    const [row] = await db.select().from(t.contentItems).where(eq(t.contentItems.id, r.id));
    expect(row.status).toBe("published");
    expect(row.publishedAt?.toISOString()).toBe(when.toISOString());
    expect(row.scheduledFor).toBeNull();
  });

  it("rejects ids that belong to another publication", async () => {
    const s = site(pub.id);
    const ed = actor("editor", "editor");
    const [foreignCat] = await db.insert(t.categories).values({ publicationId: other.id, name: "Theirs", slug: "theirs" }).returning();
    const [foreignMedia] = await db.insert(t.media).values({ publicationId: other.id, storageKey: "x/2026/01/a.jpg", mimeType: "image/jpeg" }).returning();
    const foreignStory = await makeContent(db, other.id, { title: "Their story" });
    await expect(saveContent(db, s, ed, base({ categoryId: foreignCat.id }))).rejects.toThrow(/Unknown category/);
    await expect(saveContent(db, s, ed, base({ heroImageId: foreignMedia.id }))).rejects.toThrow(/Unknown image/);
    await expect(saveContent(db, s, ed, base({ relatedIds: [foreignStory.id] }))).rejects.toThrow(/Unknown related/);
    // Editing another publication's story by id doesn't work either.
    await expect(saveContent(db, s, ed, base({ id: foreignStory.id, title: "Hijack" }))).rejects.toThrow();
    const [still] = await db.select().from(t.contentItems).where(eq(t.contentItems.id, foreignStory.id));
    expect(still.title).toBe("Their story");
    // …and its tags/bylines were not touched.
    const [tag] = await db.insert(t.tags).values({ publicationId: other.id, name: "keep", slug: "keep" }).returning();
    await db.insert(t.contentTags).values({ contentId: foreignStory.id, tagId: tag.id });
    await expect(saveContent(db, s, ed, base({ id: foreignStory.id, tagNames: [] }))).rejects.toThrow();
    expect(await db.select().from(t.contentTags).where(eq(t.contentTags.contentId, foreignStory.id))).toHaveLength(1);
  });

  it("creates tags on the fly and links them", async () => {
    const s = site(pub.id);
    const r = await saveContent(db, s, actor("editor", "editor"), base({ title: "Tagged", status: "published", tagNames: ["Night Life", "night life", "Craft"] }));
    const tags = await db.select().from(t.tags).where(eq(t.tags.publicationId, pub.id));
    expect(tags.map((x) => x.slug).sort()).toEqual(expect.arrayContaining(["craft", "night-life"]));
    const links = await db.select().from(t.contentTags).where(eq(t.contentTags.contentId, r.id));
    expect(links).toHaveLength(2);
    const nightLife = tags.find((x) => x.slug === "night-life")!;
    expect((await listPublished(db, s, { tagId: nightLife.id })).map((c) => c.id)).toEqual([r.id]);
  });

  it("refuses unsafe canonical URLs and oversized input", async () => {
    const s = site(pub.id);
    await expect(saveContent(db, s, actor("editor", "editor"), base({ canonicalUrl: "javascript:alert(1)" }))).rejects.toThrow();
    await expect(saveContent(db, s, actor("editor", "editor"), base({ title: "x".repeat(201) }))).rejects.toThrow();
  });
});

describe("taxonomy and bylines", () => {
  it("generates slugs and keeps them unique per publication", async () => {
    const s = site(pub.id);
    await saveCategory(db, s, { name: "Après Ski & Night" });
    const [c] = await db.select().from(t.categories).where(eq(t.categories.slug, "apres-ski-night"));
    expect(c.publicationId).toBe(pub.id);
    await expect(saveCategory(db, s, { name: "Après Ski & Night" })).rejects.toThrow();
    await saveCategory(db, site(other.id), { name: "Après Ski & Night" }); // fine elsewhere
  });

  it("gives a writer one byline per publication and won't delete a credited author", async () => {
    const s = site(pub.id);
    const a1 = await authorForUser(db, s, { id: users.author, name: "Author One" });
    const a2 = await authorForUser(db, s, { id: users.author, name: "Author One" });
    expect(a1).toBe(a2);
    await saveContent(db, s, actor("author", "author"), base({ title: "Credited", authorIds: [a1] }));
    await expect(deleteAuthor(db, s, a1)).rejects.toThrow(/credited/);
  });

  it("tag pages default to noindex", async () => {
    const s = site(pub.id);
    const id = await saveTag(db, s, { name: "Quiet tag" });
    const [tag] = await db.select().from(t.tags).where(eq(t.tags.id, id));
    expect(tag.indexable).toBe(false);
  });
});

describe("site management", () => {
  it("rejects homepage sections and picks from another publication", async () => {
    const [mine] = await db.insert(t.homepageSections).values({ publicationId: pub.id, kind: "editors_picks", position: 0 }).returning();
    const [theirs] = await db.insert(t.homepageSections).values({ publicationId: other.id, kind: "hero", position: 0 }).returning();
    const foreign = await makeContent(db, other.id);
    await expect(saveHomepage(db, site(pub.id), { sections: [{ id: theirs.id, enabled: false }] })).rejects.toThrow(/Unknown section/);
    await expect(saveHomepage(db, site(pub.id), { sections: [{ id: mine.id, enabled: true, contentIds: [foreign.id] }] })).rejects.toThrow(/Unknown content/);
  });

  it("validates branding so only safe values reach the page", async () => {
    const base = { name: "X", primaryColor: "#123456", fontPairing: "couture" as const, layout: "feed" as const, mode: "system" as const, ageGateEnabled: true, adPreview: false, commentsEnabled: true, timeZone: "Europe/London", nav: [] };
    await expect(saveSettings(db, site(pub.id), { ...base, primaryColor: "red; background:url(x)" })).rejects.toThrow(/hex colour/);
    await expect(saveSettings(db, site(pub.id), { ...base, timeZone: "Mars/Olympus" })).rejects.toThrow(/time zone/);
    await expect(saveSettings(db, site(pub.id), { ...base, nav: [{ label: "x", href: "javascript:alert(1)" }] })).rejects.toThrow();
    await saveSettings(db, site(pub.id), base);
    const [p] = await db.select().from(t.publications).where(eq(t.publications.id, pub.id));
    expect(p.theme.layout).toBe("feed");
    expect(p.theme.primaryColor).toBe("#123456");
  });

  it("normalises redirect paths and blocks dangerous targets", async () => {
    expect(normalisePath("https://old.example.com/Old/Story/")).toBe("/old/story");
    expect(normalisePath("old//story")).toBe("/old/story");
    const s = site(pub.id);
    await saveRedirect(db, s, { fromPath: "/Old-Story/", toPath: "/features/new-story", statusCode: 301 });
    expect((await findRedirect(db, s, "/old-story"))?.toPath).toBe("/features/new-story");
    expect(await findRedirect(db, site(other.id), "/old-story")).toBeNull();
    await expect(saveRedirect(db, s, { fromPath: "/x", toPath: "//evil.example", statusCode: 301 })).rejects.toThrow();
    await expect(saveRedirect(db, s, { fromPath: "/admin", toPath: "/", statusCode: 301 })).rejects.toThrow();
    await expect(saveRedirect(db, s, { fromPath: "/same", toPath: "/same", statusCode: 301 })).rejects.toThrow();
  });
});

describe("uploads", () => {
  it("identifies images by their bytes, not their name", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toBe("image/png");
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("<?php echo 1; ?>"))).toBeNull();
  });

  it("builds storage keys scoped to the publication, never from the file name", () => {
    const key = storageKeyFor(site(pub.id), "image/png", new Date("2026-11-05T00:00:00Z"));
    expect(key).toMatch(new RegExp(`^${pub.id}/2026/11/[a-f0-9-]+\\.png$`));
    expect(() => storageKeyFor(site(pub.id), "image/svg+xml")).toThrow();
  });
});
