import { eq } from "drizzle-orm";
import { cache } from "react";
import { getDb, type Db } from "@/db/client";
import { publicationDomains, publications } from "@/db/schema";

export type Publication = typeof publications.$inferSelect & {
  primaryHost: string | null;
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Lower-cases a Host header and strips the port. */
export function normaliseHost(host: string): string {
  const h = host.trim().toLowerCase();
  if (h.startsWith("[")) return h.slice(0, h.indexOf("]") + 1);
  return h.split(":")[0];
}

/**
 * Hosts that fall back to DEFAULT_PUBLICATION_SLUG when no domain row
 * matches: local development and Cloudflare preview URLs.
 */
function isFallbackHost(host: string): boolean {
  return LOCAL_HOSTS.has(host) || host.endsWith(".workers.dev");
}

export async function findPublicationByHost(
  db: Db,
  rawHost: string,
): Promise<Publication | null> {
  const host = normaliseHost(rawHost);

  const [byDomain] = await db
    .select({ publication: publications })
    .from(publicationDomains)
    .innerJoin(publications, eq(publications.id, publicationDomains.publicationId))
    .where(eq(publicationDomains.hostname, host))
    .limit(1);

  let publication = byDomain?.publication ?? null;

  if (!publication && isFallbackHost(host) && process.env.DEFAULT_PUBLICATION_SLUG) {
    const [bySlug] = await db
      .select()
      .from(publications)
      .where(eq(publications.slug, process.env.DEFAULT_PUBLICATION_SLUG))
      .limit(1);
    publication = bySlug ?? null;
  }

  if (!publication || publication.status !== "active") return null;

  const domains = await db
    .select()
    .from(publicationDomains)
    .where(eq(publicationDomains.publicationId, publication.id));
  const primary = domains.find((d) => d.isPrimary) ?? domains[0];

  return { ...publication, primaryHost: primary?.hostname ?? null };
}

/** Request-deduplicated lookup used by layouts, pages and metadata. */
export const getPublicationByHost = cache(async (host: string) =>
  findPublicationByHost(await getDb(), host),
);
