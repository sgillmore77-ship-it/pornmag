import { HOSTNAME_RE } from "@/lib/embeds";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import {
  auditLogs,
  categories,
  contentItems,
  homepageSectionItems,
  homepageSections,
  publications,
  redirects,
  users,
  type PublicationSettings,
  type PublicationTheme,
} from "@/db/schema";
import { FONT_PAIRINGS } from "@/lib/theme";
import type { Site } from "../site";

// ---------------------------------------------------------------------------
// Homepage
// ---------------------------------------------------------------------------

export async function getHomepageAdmin(db: Db, s: Site) {
  const sections = await db
    .select()
    .from(homepageSections)
    .where(eq(homepageSections.publicationId, s.publicationId))
    .orderBy(asc(homepageSections.position));
  const items = sections.length
    ? await db
        .select({
          sectionId: homepageSectionItems.sectionId,
          contentId: homepageSectionItems.contentId,
          categoryId: homepageSectionItems.categoryId,
          position: homepageSectionItems.position,
          title: contentItems.title,
          status: contentItems.status,
          categoryName: categories.name,
        })
        .from(homepageSectionItems)
        .leftJoin(contentItems, eq(contentItems.id, homepageSectionItems.contentId))
        .leftJoin(categories, eq(categories.id, homepageSectionItems.categoryId))
        .where(inArray(homepageSectionItems.sectionId, sections.map((x) => x.id)))
        .orderBy(asc(homepageSectionItems.position))
    : [];
  return sections.map((sec) => ({ ...sec, items: items.filter((i) => i.sectionId === sec.id) }));
}

export const homepageInput = z.object({
  sections: z
    .array(
      z.object({
        id: z.string().max(64),
        enabled: z.boolean(),
        title: z
          .string()
          .trim()
          .max(80)
          .optional()
          .transform((v) => (v ? v : null)),
        limit: z.coerce.number().int().min(1).max(24).optional(),
        contentIds: z.array(z.string().max(64)).max(24).default([]),
        categoryIds: z.array(z.string().max(64)).max(24).default([]),
      }),
    )
    .max(20),
});

/** Saves section order (array order), visibility, titles and hand-picked items. */
export async function saveHomepage(db: Db, s: Site, raw: z.input<typeof homepageInput>) {
  const { sections } = homepageInput.parse(raw);
  const owned = await db.select({ id: homepageSections.id, config: homepageSections.config }).from(homepageSections).where(eq(homepageSections.publicationId, s.publicationId));
  const ownedIds = new Map(owned.map((o) => [o.id, o.config]));
  if (sections.some((x) => !ownedIds.has(x.id))) throw new Error("Unknown section");

  const contentIds = [...new Set(sections.flatMap((x) => x.contentIds))];
  const categoryIds = [...new Set(sections.flatMap((x) => x.categoryIds))];
  if (contentIds.length) {
    const ok = await db.select({ id: contentItems.id }).from(contentItems).where(and(eq(contentItems.publicationId, s.publicationId), inArray(contentItems.id, contentIds)));
    if (ok.length !== contentIds.length) throw new Error("Unknown content in a section");
  }
  if (categoryIds.length) {
    const ok = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.publicationId, s.publicationId), inArray(categories.id, categoryIds)));
    if (ok.length !== categoryIds.length) throw new Error("Unknown category in a section");
  }

  await db.transaction(async (tx) => {
    for (const [position, sec] of sections.entries()) {
      const config = { ...(ownedIds.get(sec.id) ?? {}), limit: sec.limit };
      await tx.update(homepageSections).set({ position, enabled: sec.enabled, title: sec.title, config }).where(eq(homepageSections.id, sec.id));
      await tx.delete(homepageSectionItems).where(eq(homepageSectionItems.sectionId, sec.id));
      const rows = [
        ...sec.contentIds.map((contentId, i) => ({ sectionId: sec.id, contentId, position: i })),
        ...sec.categoryIds.map((categoryId, i) => ({ sectionId: sec.id, categoryId, position: i })),
      ];
      if (rows.length) await tx.insert(homepageSectionItems).values(rows);
    }
  });
}

// ---------------------------------------------------------------------------
// Publication settings (branding, layout, behaviour)
// ---------------------------------------------------------------------------

const navLink = z.object({
  label: z.string().trim().min(1).max(40),
  href: z
    .string()
    .trim()
    .max(200)
    .refine((h) => (h.startsWith("/") && !h.startsWith("//")) || /^https:\/\//.test(h), "links must start with / or https://"),
});

export const settingsInput = z.object({
  name: z.string().trim().min(1, "is required").max(60),
  tagline: z.string().trim().max(120).optional(),
  description: z.string().trim().max(300).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "must be a hex colour like #7A1F3D"),
  fontPairing: z.enum(Object.keys(FONT_PAIRINGS) as [keyof typeof FONT_PAIRINGS]),
  layout: z.enum(["issue", "feed"]),
  mode: z.enum(["system", "light", "dark"]),
  issueLabel: z.string().trim().max(80).optional(),
  footerBlurb: z.string().trim().max(240).optional(),
  ageGateEnabled: z.boolean(),
  commentsEnabled: z.boolean(),
  commentModeration: z.enum(["all", "first", "none", "off"]).default("first"),
  timeZone: z.string().max(60).refine((tz) => {
    try {
      new Intl.DateTimeFormat("en-GB", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "is not a valid time zone"),
  nav: z.array(navLink).max(12),
  videoHosts: z
    .array(z.string().trim().toLowerCase().transform((h) => h.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "")))
    .max(30)
    .default([])
    .transform((hs) => [...new Set(hs.filter(Boolean))])
    .refine((hs) => hs.every((h) => HOSTNAME_RE.test(h)), "should be website names like videotxxx.com"),
});

export async function saveSettings(db: Db, s: Site, raw: z.input<typeof settingsInput>) {
  const i = settingsInput.parse(raw);
  const [pub] = await db.select().from(publications).where(eq(publications.id, s.publicationId));
  if (!pub) throw new Error("Not found");
  const theme: PublicationTheme = { ...pub.theme, primaryColor: i.primaryColor, fontPairing: i.fontPairing, layout: i.layout, mode: i.mode };
  const settings: PublicationSettings = {
    ...pub.settings,
    issueLabel: i.issueLabel || undefined,
    footerBlurb: i.footerBlurb || undefined,
    ageGate: { ...pub.settings.ageGate, enabled: i.ageGateEnabled },
    commentsEnabled: i.commentsEnabled,
    commentModeration: i.commentModeration,
    timeZone: i.timeZone,
    videoHosts: i.videoHosts,
    nav: i.nav,
  };
  await db
    .update(publications)
    .set({ name: i.name, tagline: i.tagline || null, description: i.description || null, theme, settings })
    .where(eq(publications.id, s.publicationId));
  return { before: { theme: pub.theme, name: pub.name }, after: { theme, name: i.name } };
}

// ---------------------------------------------------------------------------
// Redirects
// ---------------------------------------------------------------------------

export function normalisePath(p: string): string {
  let path = p.trim();
  try {
    if (/^https?:\/\//.test(path)) path = new URL(path).pathname;
  } catch {
    /* fall through */
  }
  if (!path.startsWith("/")) path = `/${path}`;
  path = path.replace(/\/{2,}/g, "/");
  if (path.length > 1) path = path.replace(/\/$/, "");
  return path.toLowerCase();
}

export const redirectInput = z.object({
  fromPath: z.string().trim().min(1).max(500),
  toPath: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine((t) => (t.startsWith("/") && !t.startsWith("//")) || /^https:\/\//.test(t), "must start with / or https://"),
  statusCode: z.coerce.number().refine((c) => c === 301 || c === 302 || c === 308 || c === 307, "must be 301, 302, 307 or 308"),
});

export async function listRedirects(db: Db, s: Site) {
  return db.select().from(redirects).where(eq(redirects.publicationId, s.publicationId)).orderBy(desc(redirects.createdAt));
}

export async function saveRedirect(db: Db, s: Site, raw: z.input<typeof redirectInput>) {
  const i = redirectInput.parse(raw);
  const fromPath = normalisePath(i.fromPath);
  const toPath = i.toPath.startsWith("/") ? normalisePath(i.toPath) : i.toPath;
  if (fromPath === toPath) throw new Error("A redirect can't point to itself");
  if (fromPath === "/" || fromPath.startsWith("/admin") || fromPath.startsWith("/api")) throw new Error("That path can't be redirected");
  await db
    .insert(redirects)
    .values({ publicationId: s.publicationId, fromPath, toPath, statusCode: i.statusCode })
    .onConflictDoUpdate({ target: [redirects.publicationId, redirects.fromPath], set: { toPath, statusCode: i.statusCode } });
  return { fromPath, toPath };
}

export async function deleteRedirect(db: Db, s: Site, id: string) {
  const r = await db.delete(redirects).where(and(eq(redirects.id, id), eq(redirects.publicationId, s.publicationId))).returning({ fromPath: redirects.fromPath });
  if (!r.length) throw new Error("Not found");
  return r[0];
}

/** Used on 404s: is there a redirect for this path? */
export async function findRedirect(db: Db, s: Site, path: string) {
  const [r] = await db
    .select({ id: redirects.id, toPath: redirects.toPath, statusCode: redirects.statusCode })
    .from(redirects)
    .where(and(eq(redirects.publicationId, s.publicationId), eq(redirects.fromPath, normalisePath(path))))
    .limit(1);
  return r ?? null;
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export async function listActivity(db: Db, s: Site, limit = 100) {
  return db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
      actor: users.name,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .where(eq(auditLogs.publicationId, s.publicationId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}
