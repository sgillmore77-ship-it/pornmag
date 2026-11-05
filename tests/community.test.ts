import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import * as t from "@/db/schema";
import {
  deleteOwnComment,
  editComment,
  getPublicProfile,
  getThread,
  listFavourites,
  postComment,
  reportComment,
  reportContent,
  toggleFavourite,
  updateProfile,
  type Reader,
} from "@/data/community";
import {
  listCommentsForModeration,
  moderateComments,
  moderationCounts,
  removeAllComments,
  setCommentBlock,
  setRole,
  unpublishContent,
} from "@/data/admin/moderation";
import { site, type Site } from "@/data/site";
import { makeContent, makePublication, setupTestDb } from "./helpers/db";

let db: Db;
let close: () => Promise<void>;
let s: Site;
let other: Site;
let pubId: string;
let story: { id: string };
let n = 0;

const reader = (userId: string, role: Reader["actor"]["role"] = "user"): Reader => ({ userId, actor: { userId, isSuperAdmin: false, role } });

/** A new user with a membership and a handle; `approved` gives them one approved comment already. */
async function person(role: Reader["actor"]["role"] = "user", opts: { handle?: boolean } = {}) {
  n += 1;
  const id = `u${n}`;
  await db.insert(t.users).values({ id, name: `Real Name ${n}`, email: `${id}@example.com` });
  await db.insert(t.memberships).values({ publicationId: pubId, userId: id, role: role ?? "user", handle: opts.handle === false ? null : `reader_${n}` });
  return reader(id, role);
}

async function setMode(mode: "all" | "first" | "none" | "off") {
  const [p] = await db.select().from(t.publications).where(eq(t.publications.id, pubId));
  await db.update(t.publications).set({ settings: { ...p.settings, commentModeration: mode } }).where(eq(t.publications.id, pubId));
}

/** Skips the posting rate limits between test posts. */
async function age(userId: string) {
  await db.update(t.comments).set({ createdAt: new Date(Date.now() - 3600_000) }).where(eq(t.comments.userId, userId));
}

beforeAll(async () => {
  ({ db, close } = await setupTestDb());
  const pub = await makePublication(db, "comm");
  const pub2 = await makePublication(db, "comm-other");
  pubId = pub.id;
  s = site(pub.id);
  other = site(pub2.id);
  story = await makeContent(db, pub.id, { title: "Commented story" });
});
afterAll(async () => close());
beforeEach(async () => setMode("first"));

describe("posting comments", () => {
  it("holds a reader's first comment, then trusts them once one is approved", async () => {
    const r = await person();
    const first = await postComment(db, s, r, { contentId: story.id, body: "Hello there" }, null);
    expect(first.status).toBe("pending");
    const anon = await getThread(db, s, story.id, null);
    expect(anon!.comments.find((c) => c.id === first.id)).toBeUndefined();
    const own = await getThread(db, s, story.id, r);
    expect(own!.comments.find((c) => c.id === first.id)?.status).toBe("pending");

    const mod = await person("moderator");
    await moderateComments(db, s, mod.actor, [first.id], "approve");
    await age(r.userId);
    const second = await postComment(db, s, r, { contentId: story.id, body: "Back again" }, null);
    expect(second.status).toBe("approved");
  });

  it("follows the site setting: check all, check none, or off", async () => {
    const r = await person();
    await setMode("none");
    expect((await postComment(db, s, r, { contentId: story.id, body: "Straight up" }, null)).status).toBe("approved");
    await setMode("all");
    await age(r.userId);
    expect((await postComment(db, s, r, { contentId: story.id, body: "Needs a check" }, null)).status).toBe("pending");
    await setMode("off");
    await age(r.userId);
    await expect(postComment(db, s, r, { contentId: story.id, body: "Closed" }, null)).rejects.toThrow(/switched off/);
    expect((await getThread(db, s, story.id, r))!.open).toBe(false);
  });

  it("skips the queue for staff", async () => {
    const ed = await person("editor");
    await setMode("all");
    expect((await postComment(db, s, ed, { contentId: story.id, body: "From the desk" }, null)).status).toBe("approved");
  });

  it("requires a public name and respects blocks and closed stories", async () => {
    const noHandle = await person("user", { handle: false });
    await expect(postComment(db, s, noHandle, { contentId: story.id, body: "Hi" }, null)).rejects.toThrow(/public name/);

    const r = await person();
    const mod = await person("moderator");
    await setCommentBlock(db, s, mod.actor, r.userId, true, "spam");
    await expect(postComment(db, s, r, { contentId: story.id, body: "Let me in" }, null)).rejects.toThrow(/can't comment/);

    const closed = await makeContent(db, pubId, { commentsEnabled: false });
    const ok = await person();
    await expect(postComment(db, s, ok, { contentId: closed.id, body: "Closed?" }, null)).rejects.toThrow(/closed/);
  });

  it("rejects drafts, other publications' stories and junk input", async () => {
    const r = await person();
    const draft = await makeContent(db, pubId, { status: "draft", publishedAt: null });
    await expect(postComment(db, s, r, { contentId: draft.id, body: "Early" }, null)).rejects.toThrow(/isn't available/);
    const theirs = await makeContent(db, other.publicationId);
    await expect(postComment(db, s, r, { contentId: theirs.id, body: "Wrong site" }, null)).rejects.toThrow(/isn't available/);
    await expect(postComment(db, s, r, { contentId: story.id, body: " ​ " }, null)).rejects.toThrow(/a little more/);
    await expect(postComment(db, s, r, { contentId: story.id, body: "x".repeat(2001) }, null)).rejects.toThrow(/under 2000/);
  });

  it("rate-limits bursts and duplicate posts", async () => {
    const r = await person();
    await setMode("none");
    await postComment(db, s, r, { contentId: story.id, body: "One" }, null);
    await expect(postComment(db, s, r, { contentId: story.id, body: "Two" }, null)).rejects.toThrow(/Slow down/);
    await age(r.userId);
    await expect(postComment(db, s, r, { contentId: story.id, body: "One" }, null)).rejects.toThrow(/already posted/);
  });

  it("holds link-heavy comments even from trusted readers", async () => {
    const r = await person();
    await setMode("none");
    const res = await postComment(db, s, r, { contentId: story.id, body: "https://a.example https://b.example https://c.example" }, null);
    expect(res.status).toBe("pending");
  });

  it("keeps threads one level deep and only replies to visible comments", async () => {
    await setMode("none");
    const a = await person();
    const b = await person();
    const c = await person();
    const top = await postComment(db, s, a, { contentId: story.id, body: "Top level" }, null);
    const reply = await postComment(db, s, b, { contentId: story.id, parentId: top.id, body: "A reply" }, null);
    await postComment(db, s, c, { contentId: story.id, parentId: reply.id, body: "Reply to the reply" }, null);
    const thread = await getThread(db, s, story.id, null);
    const t1 = thread!.comments.find((x) => x.id === top.id)!;
    expect(t1.replies.map((r) => r.body)).toEqual(["A reply", "Reply to the reply"]);

    const d = await person();
    await setMode("all");
    const pending = await postComment(db, s, d, { contentId: story.id, body: "Not yet visible" }, null);
    await setMode("none");
    await age(a.userId);
    await expect(postComment(db, s, a, { contentId: story.id, parentId: pending.id, body: "Can't see it" }, null)).rejects.toThrow(/can't reply/);
  });

  it("never shows real names or emails, only handles", async () => {
    const thread = await getThread(db, s, story.id, null);
    const json = JSON.stringify(thread);
    expect(json).not.toMatch(/Real Name|@example\.com/);
  });
});

describe("editing and deleting", () => {
  it("lets authors edit for 15 minutes and delete their own comments only", async () => {
    await setMode("none");
    const a = await person();
    const b = await person();
    const mine = await postComment(db, s, a, { contentId: story.id, body: "Tpyo" }, null);
    await editComment(db, s, a, mine.id, "Typo");
    await expect(editComment(db, s, b, mine.id, "Hijack")).rejects.toThrow(/not found/);
    await expect(deleteOwnComment(db, s, b, mine.id)).rejects.toThrow(/not found/);
    await db.update(t.comments).set({ createdAt: new Date(Date.now() - 16 * 60_000) }).where(eq(t.comments.id, mine.id));
    await expect(editComment(db, s, a, mine.id, "Too late")).rejects.toThrow(/15 minutes/);

    await deleteOwnComment(db, s, a, mine.id);
    const [row] = await db.select().from(t.comments).where(eq(t.comments.id, mine.id));
    expect(row.status).toBe("removed");
    expect(row.body).toBe("");
    // No replies, so it vanishes from the thread entirely.
    expect((await getThread(db, s, story.id, null))!.comments.find((c) => c.id === mine.id)).toBeUndefined();
  });

  it("leaves a placeholder when a removed comment has replies", async () => {
    await setMode("none");
    const a = await person();
    const b = await person();
    const top = await postComment(db, s, a, { contentId: story.id, body: "Will go" }, null);
    await postComment(db, s, b, { contentId: story.id, parentId: top.id, body: "Reply stays" }, null);
    await deleteOwnComment(db, s, a, top.id);
    const shown = (await getThread(db, s, story.id, null))!.comments.find((c) => c.id === top.id)!;
    expect(shown.status).toBe("removed");
    expect(shown.body).toBe("");
    expect(shown.author).toBeNull();
    expect(shown.replies[0].body).toBe("Reply stays");
  });
});

describe("reports and moderation", () => {
  it("hides a comment after three reports, or one report involving a minor", async () => {
    await setMode("none");
    const author = await person();
    const c = await postComment(db, s, author, { contentId: story.id, body: "Contested" }, null);
    const [r1, r2, r3] = [await person(), await person(), await person()];
    await reportComment(db, s, r1, c.id, "spam");
    await reportComment(db, s, r1, c.id, "spam"); // duplicates don't count twice
    await reportComment(db, s, r2, c.id, "spam");
    let [row] = await db.select().from(t.comments).where(eq(t.comments.id, c.id));
    expect(row.status).toBe("approved");
    await reportComment(db, s, r3, c.id, "hate");
    [row] = await db.select().from(t.comments).where(eq(t.comments.id, c.id));
    expect(row.status).toBe("pending");

    const other2 = await person();
    await age(author.userId);
    const c2 = await postComment(db, s, author, { contentId: story.id, body: "Another" }, null);
    await reportComment(db, s, other2, c2.id, "minor");
    [row] = await db.select().from(t.comments).where(eq(t.comments.id, c2.id));
    expect(row.status).toBe("pending");
    await expect(reportComment(db, s, author, c2.id, "spam")).rejects.toThrow();
  });

  it("shows reported comments in the queue and clears reports when handled", async () => {
    const mod = await person("moderator");
    const before = await moderationCounts(db, s);
    expect(before.reported).toBeGreaterThan(0);
    const { items } = await listCommentsForModeration(db, s, "reported");
    expect(items[0].reports.length).toBeGreaterThan(0);
    await moderateComments(db, s, mod.actor, items.map((i) => i.id), "remove");
    expect((await moderationCounts(db, s)).reported).toBe(0);
  });

  it("can't moderate another publication's comments or without permission", async () => {
    await setMode("none");
    const author = await person();
    const c = await postComment(db, s, author, { contentId: story.id, body: "Mine to keep" }, null);
    const outsider: Reader = reader("outsider", "moderator");
    expect(await moderateComments(db, other, outsider.actor, [c.id], "remove")).toBe(0);
    const plain = await person();
    await expect(moderateComments(db, s, plain.actor, [c.id], "remove")).rejects.toThrow(/permission/);
    const [row] = await db.select().from(t.comments).where(eq(t.comments.id, c.id));
    expect(row.status).toBe("approved");
  });

  it("blocks and cleans up a spammer; moderators can't block staff", async () => {
    await setMode("none");
    const spammer = await person();
    await postComment(db, s, spammer, { contentId: story.id, body: "Buy now" }, null);
    const mod = await person("moderator");
    await setCommentBlock(db, s, mod.actor, spammer.userId, true, "spam");
    expect(await removeAllComments(db, s, mod.actor, spammer.userId)).toBe(1);
    const ed = await person("editor");
    await expect(setCommentBlock(db, s, mod.actor, ed.userId, true)).rejects.toThrow(/administrator/);
    await expect(setCommentBlock(db, s, mod.actor, mod.userId, true)).rejects.toThrow(/yourself/);
  });

  it("only administrators change roles, and a site keeps at least one", async () => {
    const admin = await person("admin");
    const mod = await person("moderator");
    const target = await person();
    await expect(setRole(db, s, mod.actor, target.userId, "moderator")).rejects.toThrow(/permission/);
    await setRole(db, s, admin.actor, target.userId, "moderator");
    const [m] = await db.select().from(t.memberships).where(and(eq(t.memberships.publicationId, pubId), eq(t.memberships.userId, target.userId)));
    expect(m.role).toBe("moderator");
    await expect(setRole(db, s, admin.actor, admin.userId, "user")).rejects.toThrow(/own role/);
    // Demote every other admin, then the last one can't be demoted.
    const otherAdmins = await db.select().from(t.memberships).where(and(eq(t.memberships.publicationId, pubId), eq(t.memberships.role, "admin")));
    const second = await person("admin");
    for (const o of otherAdmins) if (o.userId !== admin.userId) await setRole(db, s, second.actor, o.userId, "user");
    await setRole(db, s, second.actor, admin.userId, "user");
    await expect(setRole(db, s, { userId: "platform", isSuperAdmin: true, role: null }, second.userId, "user")).rejects.toThrow(/at least one/);
  });
});

describe("page reports", () => {
  it("needs an email when signed out, and lets editors take a page offline", async () => {
    const item = await makeContent(db, pubId, { title: "Reported page" });
    await expect(reportContent(db, s, null, { contentId: item.id, reason: "consent" }, "ip1")).rejects.toThrow(/email/);
    await reportContent(db, s, null, { contentId: item.id, reason: "consent", details: "That's me", email: "me@example.com" }, "ip1");
    await expect(reportContent(db, s, null, { contentId: item.id, reason: "nonsense", email: "me@example.com" }, "ip1")).rejects.toThrow();
    expect((await moderationCounts(db, s)).contentReports).toBe(1);
    const ed = await person("editor");
    await unpublishContent(db, s, ed.actor, item.id);
    const [row] = await db.select().from(t.contentItems).where(eq(t.contentItems.id, item.id));
    expect(row.status).toBe("draft");
    const mod = await person("moderator");
    await expect(unpublishContent(db, s, mod.actor, item.id)).rejects.toThrow(/permission/);
  });
});

describe("profiles and saved stories", () => {
  it("validates handles, keeps them unique per site, and reserves staff-sounding names", async () => {
    const a = await person("user", { handle: false });
    const b = await person("user", { handle: false });
    await updateProfile(db, s, a.userId, { handle: "Velvet_Fan", bio: "Hi" });
    await expect(updateProfile(db, s, b.userId, { handle: "velvet_fan" })).rejects.toThrow(/taken/);
    await expect(updateProfile(db, s, b.userId, { handle: "admin" })).rejects.toThrow(/reserved/);
    await expect(updateProfile(db, s, b.userId, { handle: "no spaces" })).rejects.toThrow(/lowercase/);
    // The same handle is free on another publication.
    await updateProfile(db, other, b.userId, { handle: "velvet_fan" });
    const p = await getPublicProfile(db, s, "VELVET_FAN");
    expect(p?.handle).toBe("velvet_fan");
    expect(JSON.stringify(p)).not.toMatch(/Real Name|example\.com/);
  });

  it("saves and unsaves live stories only", async () => {
    const r = await person();
    expect(await toggleFavourite(db, s, r, story.id)).toBe(true);
    expect((await listFavourites(db, s, r.userId)).map((c) => c.id)).toEqual([story.id]);
    expect((await getThread(db, s, story.id, r))!.viewer!.saved).toBe(true);
    expect(await toggleFavourite(db, s, r, story.id)).toBe(false);
    const theirs = await makeContent(db, other.publicationId);
    await expect(toggleFavourite(db, s, r, theirs.id)).rejects.toThrow(/isn't available/);
  });
});
