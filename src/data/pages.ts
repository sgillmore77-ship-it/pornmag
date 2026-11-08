import { and, asc, count, eq, gt, isNotNull, or } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { CONTACT_TOPICS, contactMessages, sitePages, type ContactTopic, type PageFooterGroup } from "@/db/schema";
import { CommunityError } from "./community";
import type { Site } from "./site";

export type SitePage = typeof sitePages.$inferSelect;
export type FooterPageLink = { slug: string; title: string; footerGroup: PageFooterGroup };

/** A published standalone page (About, Contact, Terms…) by its slug. */
export async function getPublishedPage(db: Db, s: Site, slug: string): Promise<SitePage | null> {
  const [p] = await db
    .select()
    .from(sitePages)
    .where(and(eq(sitePages.publicationId, s.publicationId), eq(sitePages.slug, slug.toLowerCase()), eq(sitePages.published, true)))
    .limit(1);
  return p ?? null;
}

/** Published pages that belong in a footer column, in display order. */
export async function listFooterPages(db: Db, s: Site): Promise<FooterPageLink[]> {
  const rows = await db
    .select({ slug: sitePages.slug, title: sitePages.title, footerGroup: sitePages.footerGroup })
    .from(sitePages)
    .where(and(eq(sitePages.publicationId, s.publicationId), eq(sitePages.published, true), isNotNull(sitePages.footerGroup)))
    .orderBy(asc(sitePages.footerGroup), asc(sitePages.position), asc(sitePages.title));
  return rows.filter((r): r is FooterPageLink => r.footerGroup === "about" || r.footerGroup === "legal");
}

/** For the sitemap. */
export async function listPublishedPages(db: Db, s: Site) {
  return db
    .select({ slug: sitePages.slug, updatedAt: sitePages.updatedAt })
    .from(sitePages)
    .where(and(eq(sitePages.publicationId, s.publicationId), eq(sitePages.published, true)));
}

// ---------------------------------------------------------------------------
// Contact form
// ---------------------------------------------------------------------------

export const contactInput = z.object({
  name: z.string().trim().min(1, "Add your name").max(120),
  email: z.string().trim().email("Add a valid email address").max(254),
  topic: z.enum(Object.keys(CONTACT_TOPICS) as [ContactTopic, ...ContactTopic[]]),
  message: z.string().trim().min(10, "Your message is a bit short").max(5000, "Keep your message under 5,000 characters"),
  /** Honeypot: a hidden field people never fill in. */
  website: z.string().optional(),
});

/** Messages per hour from one visitor (by hashed IP, or email if no IP). */
export const CONTACT_HOURLY_LIMIT = 5;

/**
 * Saves a contact-form message for the editors (Admin → Messages). Returns
 * normally for bot submissions caught by the honeypot, so bots learn nothing.
 */
export async function submitContactMessage(db: Db, s: Site, raw: unknown, ipHash: string | null): Promise<void> {
  const input = contactInput.parse(raw);
  if (input.website) return;
  const since = new Date(Date.now() - 3600_000);
  const [{ recent }] = await db
    .select({ recent: count() })
    .from(contactMessages)
    .where(
      and(
        eq(contactMessages.publicationId, s.publicationId),
        gt(contactMessages.createdAt, since),
        ipHash ? or(eq(contactMessages.ipHash, ipHash), eq(contactMessages.email, input.email)) : eq(contactMessages.email, input.email),
      ),
    );
  if (recent >= CONTACT_HOURLY_LIMIT) throw new CommunityError("You've sent several messages in the last hour. Please try again later.");
  await db.insert(contactMessages).values({
    publicationId: s.publicationId,
    name: input.name,
    email: input.email.toLowerCase(),
    topic: input.topic,
    message: input.message,
    ipHash,
  });
}
