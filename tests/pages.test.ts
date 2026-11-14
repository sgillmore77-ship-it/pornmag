import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import * as t from "@/db/schema";
import { deleteMessage, deletePage, getPageAdmin, listMessages, listPagesAdmin, savePage, setMessageHandled, unhandledMessageCount } from "@/data/admin/pages";
import { CONTACT_HOURLY_LIMIT, getPublishedPage, listFooterPages, listPublishedPages, submitContactMessage } from "@/data/pages";
import { site } from "@/data/site";
import { makePublication, setupTestDb } from "./helpers/db";

let db: Db;
let close: () => Promise<void>;
let a: Awaited<ReturnType<typeof makePublication>>;
let b: Awaited<ReturnType<typeof makePublication>>;
const userId = "pages-editor";
const doc = (text: string) => ({ type: "doc" as const, content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
const msg = (over: Record<string, unknown> = {}) => ({ name: "Sam", email: "sam@example.com", topic: "general", message: "Hello there, a question.", ...over });

beforeAll(async () => {
  ({ db, close } = await setupTestDb());
  a = await makePublication(db, "pages-a");
  b = await makePublication(db, "pages-b");
  await db.insert(t.users).values({ id: userId, name: "Editor", email: "editor@example.com" });
});

afterAll(async () => close());

describe("standalone pages", () => {
  it("creates, reads and lists pages per publication", async () => {
    await savePage(db, site(a.id), { title: "About us", slug: "about", body: doc("Hi"), footerGroup: "about", position: 1 });
    await savePage(db, site(a.id), { title: "Privacy", slug: "privacy", footerGroup: "legal", position: 2 });
    await savePage(db, site(a.id), { title: "Hidden", slug: "hidden", published: false, footerGroup: "about" });
    await savePage(db, site(b.id), { title: "B about", slug: "about", footerGroup: "about" });

    expect((await getPublishedPage(db, site(a.id), "about"))?.title).toBe("About us");
    expect((await getPublishedPage(db, site(a.id), "ABOUT"))?.title).toBe("About us");
    expect(await getPublishedPage(db, site(a.id), "hidden")).toBeNull();
    expect((await getPublishedPage(db, site(b.id), "about"))?.title).toBe("B about");

    expect(await listFooterPages(db, site(a.id))).toEqual([
      { slug: "about", title: "About us", footerGroup: "about" },
      { slug: "privacy", title: "Privacy", footerGroup: "legal" },
    ]);
    expect((await listPublishedPages(db, site(a.id))).map((p) => p.slug).sort()).toEqual(["about", "privacy"]);
    expect((await listPagesAdmin(db, site(a.id))).length).toBe(3);
  });

  it("rejects addresses the site already uses, and bad or duplicate slugs", async () => {
    for (const slug of ["reviews", "admin", "login", "api", "category"]) {
      await expect(savePage(db, site(a.id), { title: "X", slug })).rejects.toThrow();
    }
    await expect(savePage(db, site(a.id), { title: "X", slug: "Bad Slug!" })).rejects.toThrow();
    await expect(savePage(db, site(a.id), { title: "Dup", slug: "about" })).rejects.toThrow();
  });

  it("can't read, edit or delete another publication's page", async () => {
    const [bPage] = await db.select().from(t.sitePages).where(sql`${t.sitePages.publicationId} = ${b.id}`);
    expect(await getPageAdmin(db, site(a.id), bPage.id)).toBeNull();
    await expect(savePage(db, site(a.id), { id: bPage.id, title: "Hijack", slug: "hijack" })).rejects.toThrow("Page not found");
    await expect(deletePage(db, site(a.id), bPage.id)).rejects.toThrow("Page not found");
    expect((await getPageAdmin(db, site(b.id), bPage.id))?.title).toBe("B about");
  });

  it("updates and deletes a page", async () => {
    const p = await getPublishedPage(db, site(a.id), "privacy");
    await savePage(db, site(a.id), { id: p!.id, title: "Privacy policy", slug: "privacy-policy", contactTopic: "general" });
    expect(await getPublishedPage(db, site(a.id), "privacy")).toBeNull();
    const updated = await getPublishedPage(db, site(a.id), "privacy-policy");
    expect(updated).toMatchObject({ title: "Privacy policy", contactTopic: "general", footerGroup: null });
    await deletePage(db, site(a.id), p!.id);
    expect(await getPublishedPage(db, site(a.id), "privacy-policy")).toBeNull();
  });
});

describe("contact form", () => {
  it("saves a valid message for the right publication only", async () => {
    await submitContactMessage(db, site(a.id), msg({ email: "Sam@Example.com " }), "ip-1");
    const rows = await listMessages(db, site(a.id), { handled: false });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Sam", email: "sam@example.com", topic: "general" });
    expect(await listMessages(db, site(b.id), { handled: false })).toHaveLength(0);
  });

  it("validates input", async () => {
    await expect(submitContactMessage(db, site(a.id), msg({ email: "nope" }), "ip-2")).rejects.toThrow();
    await expect(submitContactMessage(db, site(a.id), msg({ message: "hi" }), "ip-2")).rejects.toThrow();
    await expect(submitContactMessage(db, site(a.id), msg({ topic: "bribes" }), "ip-2")).rejects.toThrow();
    await expect(submitContactMessage(db, site(a.id), msg({ name: "" }), "ip-2")).rejects.toThrow();
  });

  it("silently drops honeypot submissions", async () => {
    await submitContactMessage(db, site(b.id), msg({ website: "http://spam.example" }), "ip-3");
    expect(await listMessages(db, site(b.id), { handled: true })).toHaveLength(0);
  });

  it("limits messages per visitor per hour", async () => {
    for (let i = 0; i < CONTACT_HOURLY_LIMIT; i++) {
      await submitContactMessage(db, site(b.id), msg({ email: `flood${i}@example.com` }), "ip-flood");
    }
    await expect(submitContactMessage(db, site(b.id), msg({ email: "another@example.com" }), "ip-flood")).rejects.toThrow(/several messages/);
    // Same email from another IP is limited too.
    await expect(submitContactMessage(db, site(b.id), msg({ email: "flood0@example.com" }), null)).resolves.toBeUndefined();
    // A different visitor is unaffected.
    await expect(submitContactMessage(db, site(b.id), msg({ email: "other@example.com" }), "ip-other")).resolves.toBeUndefined();
  });

  it("marks messages done, reopens and deletes them, within the publication", async () => {
    const [m] = await listMessages(db, site(a.id), { handled: false });
    expect(await unhandledMessageCount(db, site(a.id))).toBe(1);
    await expect(setMessageHandled(db, site(b.id), m.id, userId, true)).rejects.toThrow("Message not found");
    await setMessageHandled(db, site(a.id), m.id, userId, true);
    expect(await unhandledMessageCount(db, site(a.id))).toBe(0);
    expect(await listMessages(db, site(a.id), { handled: false })).toHaveLength(0);
    expect(await listMessages(db, site(a.id), { handled: true })).toHaveLength(1);
    await setMessageHandled(db, site(a.id), m.id, userId, false);
    expect(await unhandledMessageCount(db, site(a.id))).toBe(1);
    await expect(deleteMessage(db, site(b.id), m.id)).rejects.toThrow("Message not found");
    await deleteMessage(db, site(a.id), m.id);
    expect(await unhandledMessageCount(db, site(a.id))).toBe(0);
  });
});

describe("starter data migrations", () => {
  it("add the domain and the six starter pages to 'main', and are safe to re-run", async () => {
    const main = await makePublication(db, "main");
    for (const file of ["drizzle/0004_custom_domain.sql", "drizzle/0006_starter_pages.sql", "drizzle/0009_atm_menu.sql"]) {
      const text = readFileSync(file, "utf8");
      await db.execute(sql.raw(text));
      await db.execute(sql.raw(text));
    }
    const pages = await listFooterPages(db, site(main.id));
    expect(pages.map((p) => p.slug)).toEqual(["about", "advertise", "contact", "terms", "privacy", "legal"]);
    expect((await getPublishedPage(db, site(main.id), "contact"))?.contactTopic).toBe("general");
    expect((await getPublishedPage(db, site(main.id), "advertise"))?.contactTopic).toBe("advertising");
    const domains = await db.select().from(t.publicationDomains).where(sql`${t.publicationDomains.publicationId} = ${main.id}`);
    expect(domains.map((d) => [d.hostname, d.isPrimary]).sort()).toEqual([["asstomouth.net", true], ["www.asstomouth.net", false]]);
    const cats = await db.select({ slug: t.categories.slug }).from(t.categories).where(sql`${t.categories.publicationId} = ${main.id}`);
    expect(cats.map((c) => c.slug).sort()).toEqual(["asian-atm", "blonde-atm", "brunette-atm", "double-anal-atm", "ebony-atm", "redhead-atm", "triple-anal-atm"]);
    const [pub] = await db.select().from(t.publications).where(sql`${t.publications.id} = ${main.id}`);
    expect(pub.settings.nav?.map((n) => n.label)).toEqual([
      "Latest videos", "ATM Anal", "Double Anal ATM", "Triple Anal ATM", "Amateur ATM", "ATM Threesomes",
      "Brunette ATM", "Blonde ATM", "Redhead ATM", "Ebony ATM", "Asian ATM",
    ]);
  });
});
