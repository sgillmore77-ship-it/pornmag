import { and, asc, count, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { CONTACT_TOPICS, contactMessages, sitePages, type ContactTopic, type RichTextDoc } from "@/db/schema";
import type { Site } from "../site";

/**
 * First path segments the site already uses. A page can't take one of these,
 * or it would hide (or be hidden by) a real part of the site.
 */
export const RESERVED_PAGE_SLUGS = new Set([
  "features", "reviews", "videos", "news", "category", "tag", "search", "u", "page",
  "login", "signup", "register", "logout", "account", "forgot-password", "reset-password", "verify-email",
  "admin", "api", "media", "fonts", "_next", "favicon.ico", "robots.txt", "sitemap.xml", "ads.txt", "feed", "rss",
]);

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const topics = Object.keys(CONTACT_TOPICS) as [ContactTopic, ...ContactTopic[]];

export const pageInput = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Add a title").max(200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Add a web address")
    .max(80)
    .regex(slugRe, "use lower-case letters, numbers and hyphens only")
    .refine((s) => !RESERVED_PAGE_SLUGS.has(s), "that address is already used by the site"),
  standfirst: z.string().trim().max(400).optional(),
  body: z.custom<RichTextDoc>((v) => !!v && typeof v === "object" && (v as { type?: unknown }).type === "doc").nullable().optional(),
  published: z.boolean().default(true),
  footerGroup: z.enum(["about", "legal"]).nullable().optional(),
  position: z.coerce.number().int().min(0).max(999).default(0),
  contactTopic: z.enum(topics).nullable().optional(),
  seoTitle: z.string().trim().max(200).optional(),
  metaDescription: z.string().trim().max(320).optional(),
});

export async function listPagesAdmin(db: Db, s: Site) {
  return db
    .select({
      id: sitePages.id,
      slug: sitePages.slug,
      title: sitePages.title,
      published: sitePages.published,
      footerGroup: sitePages.footerGroup,
      position: sitePages.position,
      updatedAt: sitePages.updatedAt,
    })
    .from(sitePages)
    .where(eq(sitePages.publicationId, s.publicationId))
    .orderBy(asc(sitePages.footerGroup), asc(sitePages.position), asc(sitePages.title));
}

export async function getPageAdmin(db: Db, s: Site, id: string) {
  const [p] = await db
    .select()
    .from(sitePages)
    .where(and(eq(sitePages.id, id), eq(sitePages.publicationId, s.publicationId)))
    .limit(1);
  return p ?? null;
}

export async function savePage(db: Db, s: Site, raw: z.input<typeof pageInput>) {
  const i = pageInput.parse(raw);
  const values = {
    title: i.title,
    slug: i.slug,
    standfirst: i.standfirst || null,
    body: i.body ?? null,
    published: i.published,
    footerGroup: i.footerGroup ?? null,
    position: i.position,
    contactTopic: i.contactTopic ?? null,
    seoTitle: i.seoTitle || null,
    metaDescription: i.metaDescription || null,
  };
  if (i.id) {
    const r = await db
      .update(sitePages)
      .set(values)
      .where(and(eq(sitePages.id, i.id), eq(sitePages.publicationId, s.publicationId)))
      .returning({ id: sitePages.id, slug: sitePages.slug });
    if (!r.length) throw new Error("Page not found");
    return r[0];
  }
  const [r] = await db
    .insert(sitePages)
    .values({ ...values, publicationId: s.publicationId })
    .returning({ id: sitePages.id, slug: sitePages.slug });
  return r;
}

export async function deletePage(db: Db, s: Site, id: string) {
  const r = await db
    .delete(sitePages)
    .where(and(eq(sitePages.id, id), eq(sitePages.publicationId, s.publicationId)))
    .returning({ slug: sitePages.slug });
  if (!r.length) throw new Error("Page not found");
  return r[0];
}

// ---------------------------------------------------------------------------
// Contact messages
// ---------------------------------------------------------------------------

export async function listMessages(db: Db, s: Site, opts: { handled: boolean; limit?: number }) {
  return db
    .select({
      id: contactMessages.id,
      name: contactMessages.name,
      email: contactMessages.email,
      topic: contactMessages.topic,
      message: contactMessages.message,
      handledAt: contactMessages.handledAt,
      createdAt: contactMessages.createdAt,
    })
    .from(contactMessages)
    .where(
      and(
        eq(contactMessages.publicationId, s.publicationId),
        opts.handled ? undefined : isNull(contactMessages.handledAt),
      ),
    )
    .orderBy(desc(contactMessages.createdAt))
    .limit(opts.limit ?? 200);
}

export async function unhandledMessageCount(db: Db, s: Site): Promise<number> {
  const [{ n }] = await db
    .select({ n: count() })
    .from(contactMessages)
    .where(and(eq(contactMessages.publicationId, s.publicationId), isNull(contactMessages.handledAt)));
  return n;
}

export async function setMessageHandled(db: Db, s: Site, id: string, userId: string, handled: boolean) {
  const r = await db
    .update(contactMessages)
    .set(handled ? { handledAt: new Date(), handledBy: userId } : { handledAt: null, handledBy: null })
    .where(and(eq(contactMessages.id, id), eq(contactMessages.publicationId, s.publicationId)))
    .returning({ id: contactMessages.id });
  if (!r.length) throw new Error("Message not found");
}

export async function deleteMessage(db: Db, s: Site, id: string) {
  const r = await db
    .delete(contactMessages)
    .where(and(eq(contactMessages.id, id), eq(contactMessages.publicationId, s.publicationId)))
    .returning({ id: contactMessages.id });
  if (!r.length) throw new Error("Message not found");
}
